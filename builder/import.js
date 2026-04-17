function importEntries(raw) {
  return (raw || []).map(e => {
    const base = { _id: uid(), type: e.type || 'paragraph' };

    
    if (e.text      !== undefined) base.text      = e.text;
    if (e.align     !== undefined) base.align     = e.align;
    if (e.fontSize  !== undefined) base.fontSize  = e.fontSize;

    
    if (e.texture   !== undefined) base.texture   = e.texture;
    if (e.scale     !== undefined) base.scale     = e.scale;
    if (e.items     !== undefined) base.items     = e.items;

    
    if (e.key       !== undefined) base.key       = e.key;
    if (e.value     !== undefined) base.value     = e.value;

    
    if (e.style     !== undefined) base.style     = e.style;

    
    if (e.height    !== undefined) base.height    = e.height;

    
    if (e.frameCount    !== undefined) base.frameCount    = e.frameCount;
    if (e.frameDuration !== undefined) base.frameDuration = e.frameDuration;
    if (e.columns       !== undefined) base.columns       = e.columns;
    if (e.rows          !== undefined) base.rows          = e.rows;

    
    if (e.label     !== undefined) base.label     = e.label;

    
    if (e.url       !== undefined) base.url       = e.url;

    
    if (e.type === 'row') {
      base.left         = importEntries(e.left);
      base.right        = importEntries(e.right);
      base.leftFraction = e.leftFraction !== undefined ? e.leftFraction : 0.5;
    }

    
    if (e.type === 'indentBlock') {
      base.entries  = importEntries(e.entries);
      base.indent   = e.indent   !== undefined ? e.indent   : 32;
      base.showRule = e.showRule !== undefined ? e.showRule : true;
    }

    
    const meta = ENTRY_TYPES.find(t => t.type === base.type);
    if (meta?.hasText  && base.text    === undefined) base.text    = '';
    if (meta?.hasAlign && base.align   === undefined) base.align   = base.type === 'caption' ? 'center' : 'left';
    if (meta?.hasImage && base.texture === undefined) { base.texture = ''; base.scale = 2; }
    if (meta?.hasImage && base.items   === undefined) base.items   = [];
    if (meta?.hasList  && base.items   === undefined) base.items   = [''];
    if (base.type === 'keyValue') {
      if (base.key   === undefined) base.key   = '';
      if (base.value === undefined) base.value = '';
    }
    if (base.type === 'divider' && base.style  === undefined) base.style  = 'single';
    if (base.type === 'spacer'  && base.height === undefined) base.height = 16;
    if (base.type === 'gif') {
      if (base.frameCount    === undefined) base.frameCount    = 1;
      if (base.frameDuration === undefined) base.frameDuration = 0.1;
      if (base.scale         === undefined) base.scale         = 1;
      if (base.columns       === undefined) base.columns       = 0;
      if (base.rows          === undefined) base.rows          = 1;
      if (base.align         === undefined) base.align         = 'left';
    }
    if (base.type === 'spoiler') {
      if (base.label === undefined) base.label = '';
      if (base.text  === undefined) base.text  = '';
    }
    if (base.type === 'link') {
      if (base.text  === undefined) base.text  = '';
      if (base.url   === undefined) base.url   = '';
      if (base.align === undefined) base.align = 'left';
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
    name:        p.name || 'Untitled',
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
  hint.innerHTML = 'Paste your <code style="background:var(--bg-parch-3);padding:1px 4px;border-radius:3px">documentation.json</code> below, or load a file. <strong>This will replace the current editor contents.</strong>';

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
  mfoot.appendChild(goBtn);

  modal.appendChild(mhdr);
  modal.appendChild(mbody);
  modal.appendChild(mfoot);
  overlay.appendChild(modal);

  
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  document.body.appendChild(overlay);
  requestAnimationFrame(() => ta.focus());
}