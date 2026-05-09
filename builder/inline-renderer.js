const TOKEN_PATTERN = /\[\(([A-Za-z]+)\)([A-Za-z0-9_]+)\]|\[([0-9]+)\]/g;

// Matches framework emote tokens: {heart}, {star}, etc.
// Name must start with a letter or underscore, followed by word characters.
// Deliberately distinct from item tokens ([...]) and i18n tokens ({{...}}).
const EMOTE_TOKEN_PATTERN = /\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

function renderInlineContent(text, spriteSize) {
  spriteSize = spriteSize || 16;
  const frag = document.createDocumentFragment();
  if (!text) return frag;

  text = resolveI18n(text);

  // Collect all token matches (both item tokens and emote tokens) in source order.
  const matches = [];

  const itemRe  = new RegExp(TOKEN_PATTERN.source, 'g');
  const emoteRe = new RegExp(EMOTE_TOKEN_PATTERN.source, 'g');

  let m;
  while ((m = itemRe.exec(text)) !== null) {
    let qualifier, itemId;
    if (m[3] !== undefined) {
      qualifier = 'O';
      itemId    = m[3];
    } else {
      qualifier = m[1];
      itemId    = m[2];
    }
    matches.push({ index: m.index, length: m[0].length, type: 'item', qualifier, itemId });
  }

  while ((m = emoteRe.exec(text)) !== null) {
    const emoteName = m[1];
    // Only treat as an emote token if the name exists in GMDF_EMOTES.
    // Unrecognised {tokens} are left as plain text so nothing disappears silently.
    if (window.GMDF_EMOTES && window.GMDF_EMOTES[emoteName]) {
      matches.push({ index: m.index, length: m[0].length, type: 'emote', emoteName });
    }
  }

  // Sort all matches by their position in the source string.
  matches.sort((a, b) => a.index - b.index);

  let lastIndex = 0;
  for (const match of matches) {
    // Plain text before this token.
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

  // Any remaining plain text after the last token.
  if (lastIndex < text.length) {
    frag.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  return frag;
}

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
    img.addEventListener('load', () => {
      if (img.naturalHeight > 0) {
        const scale = spriteSize / img.naturalHeight;
        img.style.width  = Math.round(img.naturalWidth * scale) + 'px';
        img.style.height = spriteSize + 'px';
      }
    });
    return img;
  }

  const badge = document.createElement('span');
  badge.className   = 'pv-inline-badge';
  badge.textContent = `(${qualifier})${itemId}`;
  badge.title       = `Item token: [(${qualifier})${itemId}] — not found in sprite sheet`;
  return badge;
}

function resolveEmote(emoteName, spriteSize) {
  const emotes  = window.GMDF_EMOTES || {};
  const dataUri = emotes[emoteName];

  if (dataUri) {
    const img = document.createElement('img');
    img.src       = dataUri;
    img.className = 'pv-inline-sprite pv-inline-emote';
    img.title     = `{${emoteName}}`;
    img.style.width  = spriteSize + 'px';
    img.style.height = spriteSize + 'px';
    return img;
  }

  // Fallback badge — should never appear since we guard on registration above.
  const badge = document.createElement('span');
  badge.className   = 'pv-inline-badge';
  badge.textContent = `{${emoteName}}`;
  badge.title       = `Emote token: {${emoteName}} — not registered`;
  return badge;
}
