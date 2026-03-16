const i18nStore = new Map(); 

function getActiveI18nData() {
  const key = state.activeI18nKey;
  if (!key || !i18nStore.has(key)) return {};
  return i18nStore.get(key).data || {};
}

function resolveI18n(text) {
  if (!text || typeof text !== "string") return text;
  if (!text.includes("{{i18n:")) return text;
  const data = getActiveI18nData();
  return text.replace(/\{\{i18n:([^}]+)\}\}/g, (match, key) => {
    const trimmed = key.trim();
    return Object.prototype.hasOwnProperty.call(data, trimmed) ? data[trimmed] : match;
  });
}

function mountI18nFiles(files) {
  const jsonFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith(".json"));
  if (!jsonFiles.length) return;

  let pending = jsonFiles.length;

  jsonFiles.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data  = JSON.parse(e.target.result);
        const base  = file.name.replace(/\.json$/i, "");
        const label = base.charAt(0).toUpperCase() + base.slice(1);
        i18nStore.set(file.name, { label, data });
      } catch (err) {
        console.warn("GMDF i18n: failed to parse", file.name, err);
      }
      pending--;
      if (pending === 0) {
        
        if (!state.activeI18nKey || !i18nStore.has(state.activeI18nKey)) {
          const firstKey = i18nStore.keys().next().value;
          state.activeI18nKey = firstKey || null;
        }
        render();
      }
    };
    reader.onerror = () => { pending--; if (pending === 0) render(); };
    reader.readAsText(file);
  });
}

function clearI18n() {
  i18nStore.clear();
  state.activeI18nKey = null;
  render();
}