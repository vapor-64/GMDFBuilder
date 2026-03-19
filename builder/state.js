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
    };

function pg() {
  return state.pages[state.activePageIdx] || state.pages[0];
}

function setState(patch) {
  Object.assign(state, patch);
  persistState();   
  render();
}

function silentPageUpdate(idx, patch) {
  state.pages = state.pages.map((p, i) => i === idx ? { ...p, ...patch } : p);
  debouncedSave();  
}

function silentEntryUpdate(entryIdx, field, value) {
  const page = pg();
  page.entries = page.entries.map((e, i) => i === entryIdx ? { ...e, [field]: value } : e);
  debouncedSave();  
}

function structuralPageUpdate(idx, patch) {
  const pages = [...state.pages];
  pages[idx] = { ...pages[idx], ...patch };
  setState({ pages });
}

function setEntries(entries) {
  structuralPageUpdate(state.activePageIdx, { entries });
}

const collapsedEntries = new Set();

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
    const key = "assets/" + file.name;
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