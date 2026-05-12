// ── Multi-file import (picks JSON files directly, no ZIP needed) ────────────────

/**
 * Reads an array of File objects (the manifest + per-page JSON files from the
 * documentation/ folder) and loads them into the editor.
 *
 * The manifest is identified by name: "documentation.json".
 * Page files must be named "documentation.<slug>.json".
 *
 * Errors are shown inline in the modal (errBox / ta), and the modal is
 * closed on success.
 */
function applyMultiFileImport(files, errBox, ta, overlay) {
  const PAGE_PREFIX   = 'documentation.';
  const MANIFEST_NAME = 'documentation.json';

  // Separate the manifest from page files by filename
  let manifestFile = null;
  const pageFiles  = [];

  for (const file of files) {
    const name = file.name.toLowerCase();
    if (name === MANIFEST_NAME) {
      manifestFile = file;
    } else if (name.startsWith(PAGE_PREFIX) && name.endsWith('.json')) {
      pageFiles.push(file);
    }
  }

  function showErr(msg) {
    ta.classList.add('error');
    errBox.textContent = '\u2717 ' + msg;
    errBox.className   = 'import-error visible';
  }

  if (!manifestFile) {
    // If only a single file was chosen and it looks like a regular
    // documentation.json (not a page file), fall back to single-file import.
    if (files.length === 1) {
      const reader = new FileReader();
      reader.onload = e => {
        const err = applyImport(e.target.result);
        if (err) showErr(err);
        else overlay.remove();
      };
      reader.onerror = () => showErr('Could not read the file.');
      reader.readAsText(files[0]);
      return;
    }
    showErr('No "documentation.json" manifest found among the selected files.');
    return;
  }

  // Read all files in parallel using FileReader, then assemble
  function readText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload  = e => resolve(e.target.result);
      r.onerror = () => reject(new Error('Could not read ' + file.name));
      r.readAsText(file);
    });
  }

  const allReads = [readText(manifestFile), ...pageFiles.map(readText)];

  Promise.all(allReads).then(texts => {
    // Parse manifest
    let manifest;
    try {
      manifest = JSON.parse(texts[0]);
    } catch (err) {
      showErr('Failed to parse documentation.json: ' + err.message);
      return;
    }

    if (!manifest.modName) { showErr('documentation.json is missing "modName".'); return; }
    if (manifest.format !== 1) { showErr('documentation.json has unsupported format ' + manifest.format + ' (expected 1).'); return; }

    // Parse page files
    const parsedPages = {}; // slug → page data
    pageFiles.forEach((file, i) => {
      const name = file.name;
      // Derive slug: strip "documentation." prefix and ".json" suffix
      const slug = name.slice(PAGE_PREFIX.length, -'.json'.length);
      if (!slug) return;
      try {
        parsedPages[slug] = JSON.parse(texts[i + 1]);
      } catch (err) {
        console.warn('[GMDF Import] Failed to parse page file "' + name + '": ' + err.message);
      }
    });

    if (Object.keys(parsedPages).length === 0) {
      showErr('No valid page files found. Select the manifest plus the documentation.<slug>.json page files.');
      return;
    }

    // Order: pageOrder first, then remaining alphabetically
    const pageOrder    = Array.isArray(manifest.pageOrder) ? manifest.pageOrder : [];
    const orderedSlugs = [];
    for (const slug of pageOrder) {
      if (parsedPages[slug]) orderedSlugs.push(slug);
    }
    const listed   = new Set(orderedSlugs);
    const unlisted = Object.keys(parsedPages).filter(s => !listed.has(s)).sort();
    orderedSlugs.push(...unlisted);

    const pages = orderedSlugs.map(slug => {
      const p = parsedPages[slug];
      return {
        _id:         uid(),
        id:          p.id   || slug,
        name:        p.name || 'Untitled',
        headerImage: p.headerImage?.texture || p.headerImage || '',
        entries:     importEntries(p.entries || []),
      };
    });

    clearPersistedState();
    setState({
      modName:       manifest.modName || '',
      pages,
      activePageIdx: 0,
      view:          'editor',
      multiFileMode: true,
    });

    overlay.remove();

  }).catch(err => {
    showErr(err.message);
  });
}

function importEntries(raw) {
  return (raw || []).map(e => {
    // Start from canonical defaults so any missing field is always populated
    const base = defaultEntry(e.type || 'paragraph');

    // Overlay every field the JSON provides (except type/_id which defaultEntry already set)
    const skip = new Set(['type', '_id', 'anchor']);
    for (const key of Object.keys(e)) {
      if (!skip.has(key)) base[key] = e[key];
    }

    // anchor — sectionTitle/paragraph: keep imported anchor, or the one defaultEntry generated
    if ((base.type === 'sectionTitle' || base.type === 'paragraph') && e.anchor?.trim()) {
      base.anchor = e.anchor.trim();
    }
    // internalLink anchor destination field
    if (base.type === 'internalLink' && e.anchor !== undefined) {
      base.anchor = e.anchor;
    }

    // Recurse children
    if (base.type === 'row') {
      base.left  = importEntries(e.left  || []);
      base.right = importEntries(e.right || []);
    }
    if (base.type === 'indentBlock' || base.type === 'spoiler') {
      base.entries = importEntries(e.entries || []);
    }
    // Legacy spoiler plain-text fallback
    if (base.type === 'spoiler' && (!e.entries || !e.entries.length) && e.text) {
      base.text = e.text;
    }

    return base;
  });
}

function applyImport(jsonText) {
  let doc;
  try {
    doc = JSON.parse(jsonText);
  } catch (err) {
    return 'Invalid JSON: ' + err.message;
  }
  if (!doc || typeof doc !== 'object') return 'JSON must be an object.';

  const rawPages = Array.isArray(doc)
    ? doc
    : (Array.isArray(doc.pages) ? doc.pages : null);
  if (!rawPages || !rawPages.length) return 'No "pages" array found in JSON.';

  const pages = rawPages.map(p => ({
    _id:         uid(),
    id:          p.id          || '',
    name:        p.name        || 'Untitled',
    headerImage: p.headerImage?.texture || p.headerImage || '',
    entries:     importEntries(p.entries),
  }));

  clearPersistedState(); 
  setState({
    modName:       doc.modName || state.modName || '',
    pages,
    activePageIdx: 0,
    view:          'editor',
  });
  return null; 
}

function showImportModal() {
  const overlay = document.createElement('div');
  overlay.className = 'import-overlay';

  const modal = document.createElement('div');
  modal.className = 'import-modal';

  
  const mhdr = document.createElement('div');
  mhdr.className = 'import-modal-header';

  const mTitle = document.createElement('h2');
  mTitle.textContent = '📥 Import documentation.json';

  const mClose = document.createElement('button');
  mClose.className   = 'import-modal-close';
  mClose.textContent = '×';
  mClose.addEventListener('click', () => overlay.remove());

  mhdr.appendChild(mTitle);
  mhdr.appendChild(mClose);

  
  const mbody = document.createElement('div');
  mbody.className = 'import-modal-body';

  const hint = document.createElement('div');
  hint.style.cssText = 'font-size:12px;font-family:var(--font-mono);color:var(--text-dim);line-height:1.5';
  hint.innerHTML = 'Paste your <code style="background:var(--bg-parch-3);padding:1px 4px;border-radius:3px">documentation.json</code> below, or load a file. For multi-file docs, use <strong>Load Multi-File</strong> and select the manifest + page files together. <strong>This will replace the current editor contents.</strong>';

  const ta = document.createElement('textarea');
  ta.id          = 'import-json-textarea';
  ta.name        = 'import-json';
  ta.className   = 'import-textarea';
  ta.placeholder = '{\n  "modName": "My Mod",\n  "pages": [...]\n}';
  ta.spellcheck  = false;
  ta.setAttribute('aria-label', 'Paste documentation.json here');

  const errBox = document.createElement('div');
  errBox.className = 'import-error';

  mbody.appendChild(hint);
  mbody.appendChild(ta);
  mbody.appendChild(errBox);

  
  const mfoot = document.createElement('div');
  mfoot.className = 'import-modal-footer';

  const footHint = document.createElement('span');
  footHint.className   = 'import-hint';
  footHint.textContent = 'Existing pages will be overwritten.';

  
  const fileInp  = document.createElement('input');
  fileInp.type   = 'file';
  fileInp.name   = 'import-file';
  fileInp.accept = '.json,application/json';
  fileInp.setAttribute('aria-label', 'Load JSON file');
  fileInp.style.display = 'none';
  fileInp.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      ta.value = ev.target.result;
      ta.classList.remove('error');
      errBox.className = 'import-error';
    };
    reader.readAsText(file);
  });

  const fileBtn = document.createElement('button');
  fileBtn.className   = 'import-btn-file';
  fileBtn.textContent = '📂 Load File';
  fileBtn.addEventListener('click', () => fileInp.click());

  // ── Multi-file import button (picks documentation/ JSON files directly) ──
  const multiInp          = document.createElement('input');
  multiInp.type           = 'file';
  multiInp.name           = 'import-multi';
  multiInp.accept         = '.json,application/json';
  multiInp.multiple       = true;
  multiInp.setAttribute('aria-label', 'Load multi-file documentation JSON files');
  multiInp.style.display  = 'none';
  multiInp.addEventListener('change', e => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    ta.value = '';
    errBox.className = 'import-error';
    ta.classList.remove('error');
    applyMultiFileImport(files, errBox, ta, overlay);
    // applyMultiFileImport is async — errors surface via the errBox directly
    multiInp.value = '';
  });

  const multiBtn = document.createElement('button');
  multiBtn.className   = 'import-btn-file';
  multiBtn.title       = 'Select the documentation/ JSON files (manifest + page files) directly';
  multiBtn.textContent = '🗂️ Load Multi-File';
  multiBtn.addEventListener('click', () => multiInp.click());

  const goBtn = document.createElement('button');
  goBtn.className   = 'import-btn-go';
  goBtn.textContent = 'Import →';
  goBtn.addEventListener('click', () => {
    const err = applyImport(ta.value.trim());
    if (err) {
      ta.classList.add('error');
      errBox.textContent = '✗ ' + err;
      errBox.className   = 'import-error visible';
    } else {
      overlay.remove();
    }
  });

  
  ta.addEventListener('keydown', e => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) goBtn.click();
  });

  mfoot.appendChild(footHint);
  mfoot.appendChild(fileInp);
  mfoot.appendChild(fileBtn);
  mfoot.appendChild(multiInp);
  mfoot.appendChild(multiBtn);
  mfoot.appendChild(goBtn);

  modal.appendChild(mhdr);
  modal.appendChild(mbody);
  modal.appendChild(mfoot);
  overlay.appendChild(modal);

  
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  function onOverlayKey(e) {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', onOverlayKey); }
  }
  document.addEventListener('keydown', onOverlayKey);

  document.body.appendChild(overlay);
  requestAnimationFrame(() => ta.focus());
}