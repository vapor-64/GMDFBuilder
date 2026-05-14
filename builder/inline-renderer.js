// ── Inline token patterns ─────────────────────────────────────────────────────
//
// Item sprite tokens:  [(QUAL)ID]  or  [ID]  (numeric-only ID, defaults to qualifier O)
//   Matches: [(O)128]  [(BC)12]  [128]
//   Deliberately excludes word-based tokenisable strings like [FarmName] —
//   those are resolved upstream by TokenParser (resolveI18n).
//
// Emote tokens:  {name}
//   Name must start with a letter or underscore, followed by word characters.
//   Deliberately distinct from item tokens ([...]) and i18n tokens ({{...}}).
//   Lookup is case-insensitive, matching the mod's StringComparer.OrdinalIgnoreCase
//   behaviour — {heart}, {Heart}, and {HEART} all resolve to the same texture.
//
// Both patterns are scanned in a single left-to-right pass (sorted by position)
// so that they interleave correctly with surrounding plain text, mirroring the
// C# Tokenize() method in InlineContent.cs.

const TOKEN_PATTERN       = /\[\(([A-Za-z]+)\)([A-Za-z0-9_]+)\]|\[([0-9]+)\]/g;
const EMOTE_TOKEN_PATTERN = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

// ── Case-insensitive emote lookup ─────────────────────────────────────────────
//
// The mod's EmoteRegistry stores textures in a Dictionary<string, Texture2D>
// keyed with StringComparer.OrdinalIgnoreCase, meaning {Heart} and {heart}
// both resolve.  We replicate that here by building a normalised (lower-case)
// index once per page render and using it for both registration checks and
// texture retrieval.  The canonical key stored in _emoteIndex is always
// lower-case; the value is the original key in GMDF_EMOTES so we can retrieve
// the data URI.

let _emoteIndex = null;   // Map<lowerName, originalKey>  — rebuilt on demand

function _getEmoteIndex() {
  if (_emoteIndex) return _emoteIndex;
  _emoteIndex = new Map();
  const emotes = window.GMDF_EMOTES || {};
  for (const key of Object.keys(emotes)) {
    _emoteIndex.set(key.toLowerCase(), key);
  }
  return _emoteIndex;
}

// Call this whenever GMDF_EMOTES is replaced (e.g. after hot-reload in dev).
function invalidateEmoteIndex() {
  _emoteIndex = null;
}

// Returns the data URI for an emote name (case-insensitive), or undefined.
function _lookupEmote(name) {
  const idx = _getEmoteIndex();
  const canonical = idx.get(name.toLowerCase());
  return canonical !== undefined ? (window.GMDF_EMOTES || {})[canonical] : undefined;
}

// Returns true if name is a registered emote (case-insensitive).
function _isEmoteRegistered(name) {
  return _getEmoteIndex().has(name.toLowerCase());
}

// ── Main entry point ──────────────────────────────────────────────────────────

function renderInlineContent(text, spriteSize) {
  spriteSize = spriteSize || 16;
  const frag = document.createDocumentFragment();
  if (!text) return frag;

  text = resolveI18n(text);

  // Collect all token matches (item tokens + emote tokens) in source order.
  const matches = [];

  const itemRe  = new RegExp(TOKEN_PATTERN.source, 'g');
  const emoteRe = new RegExp(EMOTE_TOKEN_PATTERN.source, 'g');

  let m;

  // ── Item sprite tokens ──────────────────────────────────────────────────────
  while ((m = itemRe.exec(text)) !== null) {
    let qualifier, itemId;
    if (m[3] !== undefined) {
      // Bare numeric form: [128]  →  treat as (O)128
      qualifier = 'O';
      itemId    = m[3];
    } else {
      qualifier = m[1];
      itemId    = m[2];
    }
    matches.push({ index: m.index, length: m[0].length, type: 'item', qualifier, itemId });
  }

  // ── Emote tokens ────────────────────────────────────────────────────────────
  while ((m = emoteRe.exec(text)) !== null) {
    const emoteName = m[1];
    // Only treat as an emote token if the name is actually registered
    // (case-insensitive).  Unrecognised {tokens} are left as plain text so
    // they don't silently disappear — matching the C# guard in Tokenize().
    if (_isEmoteRegistered(emoteName)) {
      matches.push({ index: m.index, length: m[0].length, type: 'emote', emoteName });
    }
  }

  // Sort all matches by their position in the source string.
  matches.sort((a, b) => a.index - b.index);

  let lastIndex = 0;
  for (const match of matches) {
    // Plain text between the previous match and this one.
    if (match.index > lastIndex) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
    }

    if (match.type === 'item') {
      frag.appendChild(resolveSprite(match.qualifier, match.itemId, spriteSize));
    } else {
      frag.appendChild(resolveEmote(match.emoteName, spriteSize));
    }

    lastIndex = match.index + match.length;
  }

  // Any remaining plain text after the last match.
  if (lastIndex < text.length) {
    frag.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  return frag;
}

// ── Item sprite renderer ──────────────────────────────────────────────────────
//
// Mirrors resolveSprite() / InlineSegment.FromItem() in the mod:
//   - Looks up the data URI in GMDF_SPRITES by "QUALIFIER:ID".
//   - Renders the image scaled so its height equals spriteSize (matching the
//     MeasureAtom() behaviour: spriteSize + 2 px wide slot, exact height).
//   - Falls back to a plain-text badge if the sprite is not in the sheet,
//     so the author can see which tokens are missing rather than getting silence.

function resolveSprite(qualifier, itemId, spriteSize) {
  const sprites = window.GMDF_SPRITES || {};
  const dataUri = sprites[`${qualifier}:${itemId}`];

  if (dataUri) {
    const img = document.createElement('img');
    img.src       = dataUri;
    img.className = 'pv-inline-sprite';
    img.title     = `[(${qualifier})${itemId}]`;
    img.style.width  = spriteSize + 'px';
    img.style.height = spriteSize + 'px';
    img.style.imageRendering = 'pixelated';
    img.addEventListener('load', () => {
      if (img.naturalHeight > 0) {
        const scale = spriteSize / img.naturalHeight;
        img.style.width  = Math.round(img.naturalWidth * scale) + 'px';
        img.style.height = spriteSize + 'px';
      }
    });
    return img;
  }

  // Fallback badge — visible to the author; not shown in-game.
  const badge = document.createElement('span');
  badge.className   = 'pv-inline-badge';
  badge.textContent = `(${qualifier})${itemId}`;
  badge.title       = `Item token: [(${qualifier})${itemId}] — not found in sprite sheet`;
  return badge;
}

// ── Emote renderer ────────────────────────────────────────────────────────────
//
// Mirrors resolveEmote() / InlineSegment.FromEmote() in the mod:
//   - Looks up the texture via the case-insensitive _lookupEmote() helper,
//     matching EmoteRegistry.TryGet()'s OrdinalIgnoreCase dictionary.
//   - Renders a square image at spriteSize × spriteSize (emotes are always
//     square 64×64 PNGs in the mod, so no aspect-ratio correction is applied).
//   - Falls back to a badge on lookup failure.  In practice this branch is
//     unreachable because we guard on _isEmoteRegistered() in
//     renderInlineContent() before pushing the match — same as the C# guard.

function resolveEmote(emoteName, spriteSize) {
  const dataUri = _lookupEmote(emoteName);

  if (dataUri) {
    const img = document.createElement('img');
    img.src       = dataUri;
    img.className = 'pv-inline-sprite pv-inline-emote';
    img.title     = `{${emoteName}}`;
    img.style.width  = spriteSize + 'px';
    img.style.height = spriteSize + 'px';
    img.style.imageRendering = 'pixelated';
    return img;
  }

  // Fallback badge — should never appear in normal use.
  const badge = document.createElement('span');
  badge.className   = 'pv-inline-badge';
  badge.textContent = `{${emoteName}}`;
  badge.title       = `Emote token: {${emoteName}} — not registered`;
  return badge;
}
