const STORAGE_KEY = "gmdf_builder_autosave";

function persistState() {
  try {
    const snapshot = {
      modName:       state.modName,
      pages:         state.pages,
      activePageIdx: state.activePageIdx,
      activeI18nKey: state.activeI18nKey,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    
  }
}

let _saveTimer = null;
function debouncedSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(persistState, 2000);
}

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    
    if (!Array.isArray(saved.pages) || !saved.pages.length) return null;
    return saved;
  } catch (e) {
    return null;
  }
}

function clearPersistedState() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

const _persisted = loadPersistedState();

let state = _persisted
  ? {
      modName:       _persisted.modName       ?? "",
      pages:         _persisted.pages,
      activePageIdx: _persisted.activePageIdx ?? 0,
      activeI18nKey: _persisted.activeI18nKey ?? null,
      
      view:              "editor",
      dragType:          null,
      dragOverIdx:       null,
      copyLabel:         "Copy JSON",
      sampleVariantKey:  "no-images-no-i18n",
      multiFileMode:     false,
    }
  : {
      modName:           "",
      pages:             [{ _id: uid(), name: "Overview", headerImage: "", entries: [] }],
      activePageIdx:     0,
      view:              "editor",
      dragType:          null,
      dragOverIdx:       null,
      copyLabel:         "Copy JSON",
      activeI18nKey:     null,
      sampleVariantKey:  "no-images-no-i18n",
      multiFileMode:     false,
    };

function pg() {
  return state.pages[state.activePageIdx] || state.pages[0];
}

// Transient drag state — kept outside state so it's never persisted
let _dragType    = null;
let _dragOverIdx = null;
let _dragSrcIdx  = null;   // index of the card being reordered (null = palette drag)

// Proxy getters/setters so the rest of the code keeps reading state.*
Object.defineProperty(state, 'dragType', {
  get() { return _dragType; },
  set(v) { _dragType = v; },
  enumerable: false, configurable: true,
});
Object.defineProperty(state, 'dragOverIdx', {
  get() { return _dragOverIdx; },
  set(v) { _dragOverIdx = v; },
  enumerable: false, configurable: true,
});
Object.defineProperty(state, 'dragSrcIdx', {
  get() { return _dragSrcIdx; },
  set(v) { _dragSrcIdx = v; },
  enumerable: false, configurable: true,
});

let _pendingAnchor = null;

function setState(patch, anchorSelector) {
  if (anchorSelector) _pendingAnchor = anchorSelector;
  Object.assign(state, patch);
  persistState();   
  render();
}

function silentPageUpdate(idx, patch) {
  state.pages = state.pages.map((p, i) => i === idx ? { ...p, ...patch } : p);
  debouncedSave();  
}

function silentEntryUpdate(entryIdx, field, value) {
  const pages = state.pages.map((p, pi) => {
    if (pi !== state.activePageIdx) return p;
    return { ...p, entries: p.entries.map((e, i) => i === entryIdx ? { ...e, [field]: value } : e) };
  });
  state.pages = pages;
  debouncedSave();
}

// ── Undo stack ───────────────────────────────────────────────────────────────
// Snapshots pages[] before every structural entry change (add, delete, reorder,
// move). Text-field edits (silentEntryUpdate) are NOT pushed — undo is for
// accidental structural changes, not keystroke-by-keystroke typing.
const UNDO_LIMIT = 50;
const _undoStack = [];   // array of { pages, activePageIdx } snapshots

function pushUndo() {
  _undoStack.push({
    pages:         JSON.parse(JSON.stringify(state.pages)),
    activePageIdx: state.activePageIdx,
  });
  if (_undoStack.length > UNDO_LIMIT) _undoStack.shift();
}

function undo() {
  if (!_undoStack.length) return;
  const snap = _undoStack.pop();
  // Restore without pushing another undo entry
  state.pages         = snap.pages;
  state.activePageIdx = snap.activePageIdx;
  persistState();
  render();
}

function canUndo() { return _undoStack.length > 0; }

function structuralPageUpdate(idx, patch) {
  const pages = [...state.pages];
  pages[idx] = { ...pages[idx], ...patch };
  setState({ pages });
}

function setEntries(entries) {
  pushUndo();
  structuralPageUpdate(state.activePageIdx, { entries });
}

const collapsedEntries = new Set();
const helpOpenEntries  = new Set();

const assetStore = new Map(); 

function resolveAsset(path) {
  if (!path || !path.trim()) return null;
  // Normalise to forward slashes and strip leading ./
  const normalised = path.replace(/\\/g, "/").trim().replace(/^\.\//,  "");
  // Try exact key first (e.g. "assets/header.png")
  const exact = assetStore.get(normalised);
  if (exact) return exact.blobUrl;
  // Fallback: bare filename, for backwards-compat with old saves
  const bare = normalised.split("/").pop();
  const fallback = assetStore.get(bare);
  return fallback ? fallback.blobUrl : null;
}

const IMAGE_EXTS = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;

function addAssetsFromInput(files) {
  for (const file of files) {
    if (!IMAGE_EXTS.test(file.name)) continue;
    // Prefer webkitRelativePath so folder uploads keep their subfolder structure
    // e.g. "portraits/penny.png" instead of just "penny.png".
    // For regular single-file uploads webkitRelativePath is empty, so we fall
    // back to "assets/" + the bare filename (legacy behaviour).
    const relativePath = file.webkitRelativePath
      ? file.webkitRelativePath          // "portraits/penny.png"
      : "assets/" + file.name;           // "assets/penny.png"
    // Normalise to always be under "assets/" exactly once
    const key = relativePath.startsWith("assets/")
      ? relativePath
      : "assets/" + relativePath;
    const existing = assetStore.get(key);
    if (existing) URL.revokeObjectURL(existing.blobUrl);
    assetStore.set(key, { blobUrl: URL.createObjectURL(file), originalName: file.name });
  }
  render();
}

function clearAssets() {
  for (const { blobUrl } of assetStore.values()) URL.revokeObjectURL(blobUrl);
  assetStore.clear();
  render();
}

// ── Global keyboard shortcuts ───────────────────────────────────────────────
// Registered once at load time. Skipped when focus is inside a text field
// so normal browser undo still works while typing.
document.addEventListener('keydown', e => {
  const inText = e.target.matches('input, textarea, select, [contenteditable]');
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey && !inText) {
    e.preventDefault();
    undo();
  }
});