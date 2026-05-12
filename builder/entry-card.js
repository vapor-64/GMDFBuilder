function deepCloneEntry(entry) {
  const clone = { ...entry, _id: uid() };
  if (clone.type === 'sectionTitle' || clone.type === 'paragraph') clone.anchor = slugifyAnchor();
  if (clone.left)    clone.left    = clone.left.map(deepCloneEntry);
  if (clone.right)   clone.right   = clone.right.map(deepCloneEntry);
  if (clone.entries) clone.entries = clone.entries.map(deepCloneEntry);
  return clone;
}

function purgeEntryFromSets(entry) {
  collapsedEntries.delete(entry._id);
  helpOpenEntries.delete(entry._id);
  if (entry.left)    entry.left.forEach(purgeEntryFromSets);
  if (entry.right)   entry.right.forEach(purgeEntryFromSets);
  if (entry.entries) entry.entries.forEach(purgeEntryFromSets);
}

// ── Unified drag-to-reorder session ─────────────────────────────────────────
//
// _dragSession is set on dragstart and cleared on drop or dragend.
//   .entry      – the entry being moved
//   .extract()  – silently removes the entry from its source array (no render)
//                 and returns it. The destination commitArray triggers the render.
//
// attachDragZone(containerEl, getArray, commitArray) wires any container
// element as a drop target. Because dragSessionActive() is the only gate,
// every zone can receive every drag — enabling cross-container moves.
//
let _dragSession = null;
function dragSessionActive() { return _dragSession !== null; }
function clearDragSession()  { _dragSession = null; }

function attachDragZone(containerEl, getArray, commitArray) {
  const indicator = h('div', { className: 'drop-indicator' });
  indicator.style.display = 'none';
  containerEl.appendChild(indicator);
  let overIdx = null;

  function placeIndicator(ins) {
    const cards = containerEl.querySelectorAll(':scope > .entry-card');
    indicator.style.display = '';
    if (ins >= cards.length) containerEl.appendChild(indicator);
    else containerEl.insertBefore(indicator, cards[ins]);
  }

  function calcIns(clientY) {
    const cards = containerEl.querySelectorAll(':scope > .entry-card');
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return cards.length;
  }

  containerEl.addEventListener('dragover', e => {
    if (!dragSessionActive()) return;
    e.preventDefault(); e.stopPropagation();
    const ins = calcIns(e.clientY);
    if (overIdx !== ins) { overIdx = ins; placeIndicator(ins); }
  });

  containerEl.addEventListener('dragleave', e => {
    if (!containerEl.contains(e.relatedTarget)) {
      overIdx = null; indicator.style.display = 'none';
    }
  });

  containerEl.addEventListener('drop', e => {
    if (!dragSessionActive()) return;
    e.preventDefault(); e.stopPropagation();
    indicator.style.display = 'none';
    if (overIdx === null) return;
    const session = _dragSession;
    const moved   = session.extract();       // silent remove from source
    const arr     = getArray();              // live array AFTER removal
    const ins     = Math.min(overIdx, arr.length);
    const next    = [...arr];
    next.splice(ins, 0, moved);
    overIdx = null;
    clearDragSession();
    commitArray(next);                       // single commit → single render
  });
}

// ── Drag handle helpers ──────────────────────────────────────────────────────
// Returns the drag handle element and wires up dragstart/dragend on `card`.
// liveArrRef  – { arr: <the live array that contains this entry> } — a box so
//               extract() can splice from the correct live reference without render.
// srcIdx      – the entry's current index in that live array.
// isTopLevel  – true for page-level entries, false for nested.
function makeDragHandle(card, entry, srcIdx, liveArrRef, isTopLevel) {
  const handle = h('div', {
    className: 'mini-btn drag-handle',
    title: 'Drag to reorder',
    'data-tooltip': 'Drag to reorder',
  }, '⠿');

  handle.addEventListener('mousedown', () => card.setAttribute('draggable', 'true'));
  handle.addEventListener('mouseup',   () => card.removeAttribute('draggable'));

  card.addEventListener('dragstart', e => {
    if (!card.getAttribute('draggable')) return;
    e.dataTransfer.effectAllowed = 'move';
    const ghost = new Image();
    ghost.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
    e.dataTransfer.setDragImage(ghost, 0, 0);

    if (isTopLevel) {
      state.dragSrcIdx  = srcIdx;
      state.dragOverIdx = null;
      state.dragType    = null;
    }

    _dragSession = {
      entry,
      srcIdx,
      liveArrRef,
      isTopLevel,
      extract() {
        // Splice from the live array WITHOUT calling render().
        // For top-level: liveArrRef.arr is pg().entries (we write it back directly).
        // For nested: liveArrRef.arr is entry.entries or entry[side] on the parent.
        const arr = liveArrRef.arr;
        const idx = arr.indexOf(this.entry);
        if (idx >= 0) arr.splice(idx, 1);
        if (this.isTopLevel) {
          pg().entries = arr;
          state.dragSrcIdx = null;
        }
        return this.entry;
      },
    };

    requestAnimationFrame(() => card.classList.add('entry-card-dragging'));
  });

  card.addEventListener('dragend', () => {
    card.removeAttribute('draggable');
    card.classList.remove('entry-card-dragging');
    if (isTopLevel) { state.dragSrcIdx = null; state.dragOverIdx = null; }
    clearDragSession();
  });

  return handle;
}

function renderEntryCard(entry, idx, total, callbacks, liveArrRef) {
  const cb      = callbacks || {};
  const meta    = ENTRY_TYPE_MAP.get(entry.type);
  const collapsed = collapsedEntries.has(entry._id);

  const card = h('div', { className: 'entry-card' + (collapsed ? ' entry-card-collapsed' : '') });
  card.style.borderLeftColor = meta?.color || '#ccc';

  function silentUpd(field, value) {
    if (cb.onSilentUpd) cb.onSilentUpd(field, value);
    else silentEntryUpdate(idx, field, value);
  }

  function structUpd(field, value) {
    if (cb.onStructUpd) {
      cb.onStructUpd(field, value);
    } else {
      setEntries(pg().entries.map((e, i) => i === idx ? { ...e, [field]: value } : e));
    }
  }

  const header = h('div', { className: 'entry-header' });
  const icon   = h('span', { className: 'palette-icon', style: { background: meta?.color || '#999' } }, meta?.icon || '?');
  header.appendChild(h('span', { className: 'entry-type-badge' },
    icon, h('span', { style: { color: meta?.color } }, meta?.label || entry.type)));

  if (meta?.hasAlign) header.appendChild(renderAlignGroup(entry.align || 'left', v => structUpd('align', v)));

  if (entry.type === 'divider') {
    const sel = h('select', { className: 'divider-style-select' });
    DIVIDER_STYLES.forEach(s => {
      const o = h('option', { value: s }, s);
      if (s === (entry.style || 'single')) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', e => structUpd('style', e.target.value));
    header.appendChild(sel);
  }

  if (meta?.hasFontSize) {
    const defaultFs = DEFAULT_FONT_SIZES[entry.type] || 16;
    const currentFs = entry.fontSize ?? defaultFs;
    const isCustom  = entry.fontSize !== undefined && entry.fontSize !== defaultFs;
    const fsWrap    = h('div', { className: 'font-size-ctrl' + (isCustom ? ' active' : '') });
    fsWrap.appendChild(h('span', { className: 'font-size-label' }, 'Aa'));
    const fsInp = h('input', { className: 'font-size-input', type: 'number', min: '8', max: '48', step: '1',
      title: `Font size (default: ${defaultFs}px)` });
    fsInp.value = currentFs;
    fsInp.addEventListener('input', e => {
      const v = parseInt(e.target.value);
      if (!isNaN(v) && v >= 8 && v <= 48) { fsWrap.classList.toggle('active', v !== defaultFs); structUpd('fontSize', v); }
    });
    const resetBtn = h('button', { className: 'font-size-reset',
      title: `Reset to default (${defaultFs}px)`,
      onClick: () => { fsInp.value = defaultFs; fsWrap.classList.remove('active'); structUpd('fontSize', defaultFs); }
    }, '↺');
    fsWrap.appendChild(fsInp);
    if (isCustom) fsWrap.appendChild(resetBtn);
    header.appendChild(fsWrap);
  }

  const acts = h('div', { className: 'entry-actions' });

  // Drag handle — works for top-level AND nested entries via shared _dragSession
  const isTopLevel  = cb.onMoveUp === undefined;
  const srcLiveArr  = liveArrRef || { arr: pg().entries };
  acts.appendChild(makeDragHandle(card, entry, idx, srcLiveArr, isTopLevel));

  // Help button
  const helpOpen = helpOpenEntries.has(entry._id);
  const helpInfo = ENTRY_HELP[entry.type];
  if (helpInfo) {
    const entrySeen = helpSeenEntryKey(entry.type);
    const helpBtn = h('button', {
      className: 'mini-btn help-entry-btn' + (helpOpen ? ' active' : '') + (isHelpSeen(entrySeen) ? '' : ' help-entry-btn-unseen'),
      title: 'Help', 'data-tooltip': 'Help',
      onClick: () => {
        markHelpSeen(entrySeen);
        helpBtn.classList.remove('help-entry-btn-unseen');
        const ring = helpBtnWrap.querySelector('.help-orbit-ring');
        if (ring) ring.remove();
        if (helpOpenEntries.has(entry._id)) helpOpenEntries.delete(entry._id);
        else helpOpenEntries.add(entry._id);
        render();
      }
    }, '?');
    const helpBtnWrap = h('div', { className: 'help-btn-wrap' });
    helpBtnWrap.appendChild(helpBtn);
    if (!isHelpSeen(entrySeen)) helpBtnWrap.appendChild(h('span', { className: 'help-orbit-ring' }));
    acts.appendChild(helpBtnWrap);
  }

  if (entry.type === 'sectionTitle' || entry.type === 'paragraph') {
    const copyAnchorBtn = h('button', {
      className: 'mini-btn copy-anchor-btn', title: 'Copy anchor ID', 'data-tooltip': 'Copy anchor ID',
      onClick: () => {
        navigator.clipboard?.writeText(entry.anchor || '');
        copyAnchorBtn.textContent = '\u2713';
        copyAnchorBtn.classList.add('copied');
        setTimeout(() => { copyAnchorBtn.textContent = '\uD83D\uDD17'; copyAnchorBtn.classList.remove('copied'); }, 1500);
      }
    }, '\uD83D\uDD17');
    acts.appendChild(copyAnchorBtn);
  }

  acts.appendChild(h('button', {
    className: 'mini-btn collapse-btn' + (collapsed ? ' collapsed' : ''),
    title: collapsed ? 'Expand' : 'Collapse', 'data-tooltip': collapsed ? 'Expand' : 'Collapse',
    onClick: () => {
      if (collapsedEntries.has(entry._id)) collapsedEntries.delete(entry._id);
      else collapsedEntries.add(entry._id);
      render();
    }
  }, collapsed ? '▶' : '▼'));

  if (cb.onMoveUp !== undefined) {
    acts.appendChild(h('button', { className: 'mini-btn move', title: 'Move up', 'data-tooltip': 'Move up',
      disabled: !cb.onMoveUp, onClick: () => cb.onMoveUp?.() }, '↑'));
    acts.appendChild(h('button', { className: 'mini-btn move', title: 'Move down', 'data-tooltip': 'Move down',
      disabled: !cb.onMoveDown, onClick: () => cb.onMoveDown?.() }, '↓'));
  } else {
    acts.appendChild(h('button', { className: 'mini-btn move', title: 'Move up', 'data-tooltip': 'Move up', disabled: idx === 0,
      onClick: () => { const e = [...pg().entries]; [e[idx-1], e[idx]] = [e[idx], e[idx-1]]; setEntries(e); } }, '↑'));
    acts.appendChild(h('button', { className: 'mini-btn move', title: 'Move down', 'data-tooltip': 'Move down', disabled: idx === total - 1,
      onClick: () => { const e = [...pg().entries]; [e[idx], e[idx+1]] = [e[idx+1], e[idx]]; setEntries(e); } }, '↓'));
  }

  if (cb.onDuplicate !== undefined) {
    acts.appendChild(h('button', { className: 'mini-btn dupe', title: 'Duplicate', 'data-tooltip': 'Duplicate',
      onClick: () => cb.onDuplicate() }, '⧉'));
  } else {
    acts.appendChild(h('button', { className: 'mini-btn dupe', title: 'Duplicate', 'data-tooltip': 'Duplicate',
      onClick: () => {
        const entries = [...pg().entries];
        entries.splice(idx + 1, 0, deepCloneEntry(entry));
        setEntries(entries);
      }
    }, '⧉'));
  }

  acts.appendChild(h('button', { className: 'mini-btn danger', title: 'Remove', 'data-tooltip': 'Remove',
    onClick: cb.onDelete || (() => { purgeEntryFromSets(entry); setEntries(pg().entries.filter((_, i) => i !== idx)); })
  }, '×'));

  header.appendChild(acts);
  card.appendChild(header);

  if (helpOpen && helpInfo) {
    const pop = h('div', { className: 'entry-help-popover' });
    pop.appendChild(h('div', { className: 'entry-help-summary' }, helpInfo.summary));
    if (helpInfo.params.length > 0) {
      const table = h('dl', { className: 'entry-help-params' });
      helpInfo.params.forEach(p => { table.appendChild(h('dt', {}, p.name)); table.appendChild(h('dd', {}, p.desc)); });
      pop.appendChild(table);
    }
    card.appendChild(pop);
  }

  if (collapsed) return card;

  const body = h('div', { className: 'entry-body' });

  if (meta?.hasText) {
    const f = h('div', { className: 'field' });
    f.appendChild(h('label', { className: 'field-label' }, 'Text'));
    if (entry.type === 'paragraph') {
      const ta = h('textarea', { className: 'textarea', placeholder: 'Text content or {{i18n:key}}' });
      ta.value = entry.text || '';
      ta.addEventListener('input', e => silentUpd('text', e.target.value));
      f.appendChild(renderI18nPicker(ta));
    } else {
      const inp = h('input', { className: 'input', placeholder: 'Text content or {{i18n:key}}' });
      inp.value = entry.text || '';
      inp.addEventListener('input', e => silentUpd('text', e.target.value));
      f.appendChild(renderI18nPicker(inp));
    }
    body.appendChild(f);
  }

  if (meta?.hasImage) {
    const row = h('div', { className: 'field-row' });
    const f1 = h('div', { className: 'field' }); f1.style.flex = '3';
    f1.appendChild(h('label', { className: 'field-label' }, 'Texture Path'));
    const texInp = h('input', { className: 'input', placeholder: 'my-image.png' });
    texInp.value = entry.texture || '';
    texInp.addEventListener('input', e => silentUpd('texture', e.target.value));
    f1.appendChild(texInp); row.appendChild(f1);
    const f2 = h('div', { className: 'field' }); f2.style.flex = '1';
    f2.appendChild(h('label', { className: 'field-label' }, 'Scale'));
    const scInp = h('input', { className: 'input input-sm', type: 'number', step: '0.5', min: '0.1' });
    scInp.value = entry.scale ?? 2;
    scInp.addEventListener('input', e => silentUpd('scale', parseFloat(e.target.value) || 2));
    f2.appendChild(scInp); row.appendChild(f2);
    body.appendChild(row);
    const itemsF = h('div', { className: 'field' });
    itemsF.appendChild(h('label', { className: 'field-label' }, 'Float Items (optional — beside image when left/right)'));
    itemsF.appendChild(renderListItems(entry.items || [], false, (v, s) => { if (s) structUpd('items', v); else silentUpd('items', v); }));
    body.appendChild(itemsF);
  }

  if (meta?.hasList) {
    const f = h('div', { className: 'field' });
    f.appendChild(h('label', { className: 'field-label' }, 'Items'));
    f.appendChild(renderListItems(entry.items || [''], entry.type === 'orderedList',
      (v, s) => { if (s) structUpd('items', v); else silentUpd('items', v); }));
    body.appendChild(f);
  }

  if (entry.type === 'keyValue') {
    const row = h('div', { className: 'field-row' });
    const f1 = h('div', { className: 'field' });
    f1.appendChild(h('label', { className: 'field-label' }, 'Key'));
    const ki = h('input', { className: 'input', placeholder: 'Key' });
    ki.value = entry.key || ''; ki.addEventListener('input', e => silentUpd('key', e.target.value));
    f1.appendChild(renderI18nPicker(ki)); row.appendChild(f1);
    const f2 = h('div', { className: 'field' }); f2.style.flex = '2';
    f2.appendChild(h('label', { className: 'field-label' }, 'Value'));
    const vi = h('input', { className: 'input', placeholder: 'Value' });
    vi.value = entry.value || ''; vi.addEventListener('input', e => silentUpd('value', e.target.value));
    f2.appendChild(renderI18nPicker(vi)); row.appendChild(f2);
    body.appendChild(row);
  }

  if (entry.type === 'spacer') {
    const f = h('div', { className: 'field' });
    f.appendChild(h('label', { className: 'field-label' }, 'Height (px)'));
    const inp = h('input', { className: 'input input-sm', type: 'number', min: '1' });
    inp.value = entry.height ?? 16;
    inp.addEventListener('input', e => silentUpd('height', parseInt(e.target.value) || 16));
    f.appendChild(inp); body.appendChild(f);
  }

  // ── Spoiler ──────────────────────────────────────────────────────────────
  if (meta?.hasSpoiler) {
    const lf = h('div', { className: 'field' });
    lf.appendChild(h('label', { className: 'field-label' }, 'Label (header bar text)'));
    const li = h('input', { className: 'input', placeholder: 'Spoiler' });
    li.value = entry.label || '';
    li.addEventListener('input', e => silentUpd('label', e.target.value));
    lf.appendChild(renderI18nPicker(li));
    body.appendChild(lf);

    const spoilerItems = entry.entries || [];
    // liveArrRef for spoiler children — points to entry.entries on the parent
    const spoilerLiveArr = { arr: entry.entries || [] };
    const spoilerEntriesEl = h('div', { className: 'row-col-entries' });

    spoilerItems.forEach((sub, si) => {
      const subCb = {
        onSilentUpd: (field, value) => { entry.entries[si] = { ...entry.entries[si], [field]: value }; },
        onStructUpd: (field, value) => {
          const u = [...entry.entries]; u[si] = { ...u[si], [field]: value }; structUpd('entries', u);
        },
        onDelete: () => {
          purgeEntryFromSets(sub);
          const u = [...entry.entries]; u.splice(si, 1); structUpd('entries', u);
        },
        onMoveUp:   si > 0 ? () => { const u = [...entry.entries]; [u[si-1],u[si]]=[u[si],u[si-1]]; structUpd('entries', u); } : null,
        onMoveDown: si < spoilerItems.length - 1 ? () => { const u = [...entry.entries]; [u[si],u[si+1]]=[u[si+1],u[si]]; structUpd('entries', u); } : null,
        onDuplicate: () => { const u = [...entry.entries]; u.splice(si+1, 0, deepCloneEntry(sub)); structUpd('entries', u); },
      };
      spoilerEntriesEl.appendChild(renderEntryCard(sub, si, spoilerItems.length, subCb, spoilerLiveArr));
    });
    body.appendChild(spoilerEntriesEl);
    attachDragZone(spoilerEntriesEl, () => entry.entries || [], arr => structUpd('entries', arr));

    const spoilerAddWrap = h('div', { style: { position: 'relative', marginTop: '6px' } });
    const spoilerAddBtn  = h('button', { className: 'row-add-btn', onClick: evt => {
      evt.stopPropagation();
      document.querySelectorAll('.row-type-picker').forEach(el => el.remove());
      const picker = h('div', { className: 'row-type-picker' });
      ENTRY_TYPES.forEach(t => {
        const item = h('div', { className: 'row-type-picker-item' });
        item.appendChild(h('span', { className: 'palette-icon', style: { background: t.color, width: '16px', height: '16px', fontSize: '10px' } }, t.icon));
        item.appendChild(document.createTextNode(t.label));
        item.addEventListener('click', () => { picker.remove(); structUpd('entries', [...(entry.entries || []), defaultEntry(t.type)]); });
        picker.appendChild(item);
      });
      setTimeout(() => document.addEventListener('click', function closer() { picker.remove(); document.removeEventListener('click', closer); }, { once: true }), 0);
      spoilerAddWrap.appendChild(picker);
    } }, '+ Add Child Entry');
    spoilerAddWrap.appendChild(spoilerAddBtn);
    body.appendChild(spoilerAddWrap);
  }

  if (meta?.hasGif) {
    const gifRow1 = h('div', { className: 'field-row' });
    const gifTexF = h('div', { className: 'field' }); gifTexF.style.flex = '3';
    gifTexF.appendChild(h('label', { className: 'field-label' }, 'Sprite Sheet Path'));
    const gifTexInp = h('input', { className: 'input', placeholder: 'animation.png' });
    gifTexInp.value = entry.texture || '';
    gifTexInp.addEventListener('input', e => silentUpd('texture', e.target.value));
    gifTexF.appendChild(gifTexInp); gifRow1.appendChild(gifTexF);
    const gifScF = h('div', { className: 'field' }); gifScF.style.flex = '1';
    gifScF.appendChild(h('label', { className: 'field-label' }, 'Scale'));
    const gifScInp = h('input', { className: 'input input-sm', type: 'number', step: '0.5', min: '0.1' });
    gifScInp.value = entry.scale ?? 1;
    gifScInp.addEventListener('input', e => silentUpd('scale', parseFloat(e.target.value) || 1));
    gifScF.appendChild(gifScInp); gifRow1.appendChild(gifScF);
    body.appendChild(gifRow1);

    const gifRow2 = h('div', { className: 'field-row' });
    const gifFcF = h('div', { className: 'field' });
    gifFcF.appendChild(h('label', { className: 'field-label' }, 'Frame Count'));
    const gifFcInp = h('input', { className: 'input input-sm', type: 'number', min: '1', step: '1' });
    gifFcInp.value = entry.frameCount ?? 1;
    gifFcInp.addEventListener('input', e => structUpd('frameCount', parseInt(e.target.value) || 1));
    gifFcF.appendChild(gifFcInp); gifRow2.appendChild(gifFcF);
    const gifFdF = h('div', { className: 'field' });
    gifFdF.appendChild(h('label', { className: 'field-label' }, 'Frame Duration (s)'));
    const gifFdInp = h('input', { className: 'input input-sm', type: 'number', step: '0.01', min: '0.016' });
    gifFdInp.value = entry.frameDuration ?? 0.1;
    gifFdInp.addEventListener('input', e => silentUpd('frameDuration', parseFloat(e.target.value) || 0.1));
    gifFdF.appendChild(gifFdInp); gifRow2.appendChild(gifFdF);
    body.appendChild(gifRow2);

    const gifRow3 = h('div', { className: 'field-row' });
    const gifColsF = h('div', { className: 'field' });
    gifColsF.appendChild(h('label', { className: 'field-label' }, 'Columns (0 = single strip)'));
    const gifColsInp = h('input', { className: 'input input-sm', type: 'number', min: '0', step: '1' });
    gifColsInp.value = entry.columns ?? 0;
    gifColsInp.addEventListener('input', e => silentUpd('columns', parseInt(e.target.value) || 0));
    gifColsF.appendChild(gifColsInp); gifRow3.appendChild(gifColsF);
    const gifRowsF = h('div', { className: 'field' });
    gifRowsF.appendChild(h('label', { className: 'field-label' }, 'Rows'));
    const gifRowsInp = h('input', { className: 'input input-sm', type: 'number', min: '1', step: '1' });
    gifRowsInp.value = entry.rows ?? 1;
    gifRowsInp.addEventListener('input', e => silentUpd('rows', parseInt(e.target.value) || 1));
    gifRowsF.appendChild(gifRowsInp); gifRow3.appendChild(gifRowsF);
    body.appendChild(gifRow3);
    body.appendChild(h('div', { style: { fontSize: '11px', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)', marginTop: '2px', lineHeight: '1.4' } }, ''));
  }

  if (meta?.hasLink) {
    const lf = h('div', { className: 'field' });
    lf.appendChild(h('label', { className: 'field-label' }, 'Label'));
    const li = h('input', { className: 'input', placeholder: 'Visit Nexus Mods' });
    li.value = entry.text || '';
    li.addEventListener('input', e => silentUpd('text', e.target.value));
    lf.appendChild(renderI18nPicker(li));
    body.appendChild(lf);
    const uf = h('div', { className: 'field' });
    uf.appendChild(h('label', { className: 'field-label' }, 'URL'));
    const urlRow = h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } });
    const ui = h('input', { className: 'input', placeholder: 'https://' });
    ui.value = entry.url || '';
    ui.addEventListener('input', e => silentUpd('url', e.target.value));
    urlRow.appendChild(ui);
    const badge = h('span', { style: { fontFamily: 'var(--font-mono)', fontSize: '10px', whiteSpace: 'nowrap', padding: '2px 6px', borderRadius: '3px', flexShrink: '0' } });
    function updateBadge(url) {
      const safe = /^https?:\/\//i.test(url);
      badge.textContent = safe ? '✓ safe' : '✗ unsafe';
      badge.style.background = safe ? 'rgba(60,120,60,0.18)' : 'rgba(180,60,60,0.18)';
      badge.style.color = safe ? '#3a8a3a' : '#c03030';
    }
    updateBadge(entry.url || '');
    ui.addEventListener('input', e => updateBadge(e.target.value));
    urlRow.appendChild(badge); uf.appendChild(urlRow); body.appendChild(uf);
  }

  if (meta?.hasInternalLink) {
    const lf = h('div', { className: 'field' });
    lf.appendChild(h('label', { className: 'field-label' }, 'Label'));
    const li = h('input', { className: 'input', placeholder: '\u2192 See the Crafting page' });
    li.value = entry.text || '';
    li.addEventListener('input', e => silentUpd('text', e.target.value));
    lf.appendChild(renderI18nPicker(li)); body.appendChild(lf);

    const mf = h('div', { className: 'field' });
    mf.appendChild(h('label', { className: 'field-label' }, 'Target Mod UniqueID (blank = this mod)'));
    const mi = h('input', { className: 'input', placeholder: 'e.g. author.ModName  (leave blank to link within this mod)' });
    mi.value = entry.mod || ''; mi.addEventListener('input', e => structUpd('mod', e.target.value));
    mf.appendChild(mi); body.appendChild(mf);

    const destRow = h('div', { className: 'field-row' });
    const pf = h('div', { className: 'field' });
    pf.appendChild(h('label', { className: 'field-label' }, 'Target Page ID (blank = first page)'));
    const pi = h('input', { className: 'input', placeholder: 'e.g. crafting' });
    pi.value = entry.page || ''; pi.addEventListener('input', e => structUpd('page', e.target.value));
    pf.appendChild(pi); destRow.appendChild(pf);
    const af = h('div', { className: 'field' });
    af.appendChild(h('label', { className: 'field-label' }, 'Anchor (blank = page top)'));
    const ai = h('input', { className: 'input', placeholder: 'e.g. advanced-recipes' });
    ai.value = entry.anchor || ''; ai.addEventListener('input', e => structUpd('anchor', e.target.value));
    af.appendChild(ai); destRow.appendChild(af);
    body.appendChild(destRow);

    const isCrossMod  = (entry.mod || '').trim().length > 0;
    const targetPage  = (entry.page || '').trim();
    const targetAnchor = (entry.anchor || '').trim();
    let hintText = '', hintOk = true;

    if (isCrossMod) {
      hintText = '\u2139 Cross-mod link \u2014 target will be greyed out in-game if that mod has no documentation registered.'; hintOk = null;
    } else if (!targetPage && !targetAnchor) {
      hintText = '\u26a0 Specify at least one of: page, anchor.'; hintOk = false;
    } else {
      const pageMatch = targetPage
        ? state.pages.find(p => (p.id || p.name || '').toLowerCase().replace(/ /g, '-') === targetPage.toLowerCase())
        : state.pages[0];
      if (targetPage && !pageMatch) {
        hintText = `\u2717 No page with ID \u201c${targetPage}\u201d found in this document.`; hintOk = false;
      } else if (targetAnchor) {
        const anchorMatch = (pageMatch ? pageMatch.entries || [] : []).some(e => (e.anchor || '').toLowerCase() === targetAnchor.toLowerCase());
        hintText = anchorMatch
          ? `\u2713 Resolved: page \u201c${pageMatch.name}\u201d \u203a anchor \u201c${targetAnchor}\u201d`
          : `\u26a0 Anchor \u201c${targetAnchor}\u201d not found on page \u201c${pageMatch ? pageMatch.name : '(unknown)'}\u201d.`;
        hintOk = anchorMatch;
      } else {
        hintText = `\u2713 Resolved: page \u201c${pageMatch.name}\u201d (top)`; hintOk = true;
      }
    }
    body.appendChild(h('div', { className: 'internal-link-hint',
      style: { color: hintOk === null ? 'var(--md-text-dim)' : hintOk ? 'var(--md-ok)' : 'var(--md-warn)' }
    }, hintText));
  }

  // ── Row (two columns) ─────────────────────────────────────────────────────
  if (entry.type === 'row') {
    const fracRow = h('div', { className: 'field-row', style: { marginBottom: '8px', alignItems: 'center', gap: '8px' } });
    const fracInp = h('input', { type: 'range', min: '20', max: '80', step: '5', style: { flex: '1' } });
    fracInp.value = Math.round((entry.leftFraction ?? 0.5) * 100);
    const fracLbl = h('span', { style: { fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-dim)' } }, fracInp.value + '%');
    fracInp.addEventListener('input', e => { const pct = parseInt(e.target.value); fracLbl.textContent = pct + '%'; silentUpd('leftFraction', pct / 100); });
    fracInp.addEventListener('change', e => structUpd('leftFraction', parseInt(e.target.value) / 100));
    fracRow.appendChild(fracInp); fracRow.appendChild(fracLbl);
    body.appendChild(fracRow);

    function renderColumnEditor(side) {
      const colItems   = entry[side] || [];
      const colLiveArr = { arr: entry[side] || [] };
      const col        = h('div', { className: 'row-col' });
      col.appendChild(h('div', { className: 'row-col-label' }, side === 'left' ? '◧ LEFT' : '◨ RIGHT'));
      const entriesEl = h('div', { className: 'row-col-entries' });

      colItems.forEach((sub, si) => {
        const subCb = {
          onSilentUpd: (field, value) => { entry[side][si] = { ...entry[side][si], [field]: value }; },
          onStructUpd: (field, value) => { const u = [...entry[side]]; u[si] = { ...u[si], [field]: value }; structUpd(side, u); },
          onDelete: () => { purgeEntryFromSets(sub); const u = [...entry[side]]; u.splice(si, 1); structUpd(side, u); },
          onMoveUp:   si > 0 ? () => { const u = [...entry[side]]; [u[si-1],u[si]]=[u[si],u[si-1]]; structUpd(side, u); } : null,
          onMoveDown: si < colItems.length - 1 ? () => { const u = [...entry[side]]; [u[si],u[si+1]]=[u[si+1],u[si]]; structUpd(side, u); } : null,
          onDuplicate: () => { const u = [...entry[side]]; u.splice(si+1, 0, deepCloneEntry(sub)); structUpd(side, u); },
        };
        entriesEl.appendChild(renderEntryCard(sub, si, colItems.length, subCb, colLiveArr));
      });

      col.appendChild(entriesEl);
      attachDragZone(entriesEl, () => entry[side] || [], arr => structUpd(side, arr));

      const addWrap = h('div', { style: { position: 'relative' } });
      const addBtn  = h('button', { className: 'row-add-btn', onClick: evt => {
        evt.stopPropagation();
        document.querySelectorAll('.row-type-picker').forEach(el => el.remove());
        const picker = h('div', { className: 'row-type-picker' });
        COLUMN_ENTRY_TYPES.forEach(t => {
          const item = h('div', { className: 'row-type-picker-item' });
          item.appendChild(h('span', { className: 'palette-icon', style: { background: t.color, width: '16px', height: '16px', fontSize: '10px' } }, t.icon));
          item.appendChild(document.createTextNode(t.label));
          item.addEventListener('click', () => { picker.remove(); structUpd(side, [...(entry[side] || []), defaultEntry(t.type)]); });
          picker.appendChild(item);
        });
        setTimeout(() => document.addEventListener('click', function closer() { picker.remove(); document.removeEventListener('click', closer); }, { once: true }), 0);
        addWrap.appendChild(picker);
      } }, '+ Add to ' + side.toUpperCase());
      addWrap.appendChild(addBtn); col.appendChild(addWrap);
      return col;
    }

    const cols = h('div', { className: 'row-columns' });
    cols.appendChild(renderColumnEditor('left'));
    cols.appendChild(renderColumnEditor('right'));
    body.appendChild(cols);
  }

  // ── Indent block ──────────────────────────────────────────────────────────
  if (entry.type === 'indentBlock') {
    const indentRow = h('div', { className: 'field-row', style: { marginBottom: '8px', alignItems: 'center', gap: '8px' } });
    indentRow.appendChild(h('label', { className: 'field-label', style: { margin: '0', whiteSpace: 'nowrap' } }, 'Indent (px)'));
    const indentInp = h('input', { className: 'input input-sm', type: 'number', min: '0', max: '200', step: '8' });
    indentInp.value = entry.indent ?? 32;
    indentInp.addEventListener('input', e => silentUpd('indent', Math.max(0, parseInt(e.target.value) || 32)));
    indentInp.addEventListener('change', e => structUpd('indent', Math.max(0, parseInt(e.target.value) || 32)));
    const ruleCb = h('input', { type: 'checkbox', id: 'showRule_' + entry._id, style: { cursor: 'pointer' } });
    ruleCb.checked = entry.showRule !== false;
    ruleCb.addEventListener('change', e => structUpd('showRule', e.target.checked));
    const ruleLbl = h('label', { htmlFor: 'showRule_' + entry._id, className: 'field-label',
      style: { margin: '0', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' } }, 'Show vertical rule');
    indentRow.appendChild(indentInp); indentRow.appendChild(ruleCb); indentRow.appendChild(ruleLbl);
    body.appendChild(indentRow);

    const childItems   = entry.entries || [];
    const childLiveArr = { arr: entry.entries || [] };
    const childEntriesEl = h('div', { className: 'row-col-entries' });

    childItems.forEach((sub, si) => {
      const subCb = {
        onSilentUpd: (field, value) => { entry.entries[si] = { ...entry.entries[si], [field]: value }; },
        onStructUpd: (field, value) => { const u = [...entry.entries]; u[si] = { ...u[si], [field]: value }; structUpd('entries', u); },
        onDelete: () => { purgeEntryFromSets(sub); const u = [...entry.entries]; u.splice(si, 1); structUpd('entries', u); },
        onMoveUp:   si > 0 ? () => { const u = [...entry.entries]; [u[si-1],u[si]]=[u[si],u[si-1]]; structUpd('entries', u); } : null,
        onMoveDown: si < childItems.length - 1 ? () => { const u = [...entry.entries]; [u[si],u[si+1]]=[u[si+1],u[si]]; structUpd('entries', u); } : null,
        onDuplicate: () => { const u = [...entry.entries]; u.splice(si+1, 0, deepCloneEntry(sub)); structUpd('entries', u); },
      };
      childEntriesEl.appendChild(renderEntryCard(sub, si, childItems.length, subCb, childLiveArr));
    });

    body.appendChild(childEntriesEl);
    attachDragZone(childEntriesEl, () => entry.entries || [], arr => structUpd('entries', arr));

    const addWrap = h('div', { style: { position: 'relative', marginTop: '6px' } });
    const addBtn  = h('button', { className: 'row-add-btn', onClick: evt => {
      evt.stopPropagation();
      document.querySelectorAll('.row-type-picker').forEach(el => el.remove());
      const picker = h('div', { className: 'row-type-picker' });
      COLUMN_ENTRY_TYPES.forEach(t => {
        const item = h('div', { className: 'row-type-picker-item' });
        item.appendChild(h('span', { className: 'palette-icon', style: { background: t.color, width: '16px', height: '16px', fontSize: '10px' } }, t.icon));
        item.appendChild(document.createTextNode(t.label));
        item.addEventListener('click', () => { picker.remove(); structUpd('entries', [...(entry.entries || []), defaultEntry(t.type)]); });
        picker.appendChild(item);
      });
      setTimeout(() => document.addEventListener('click', function closer() { picker.remove(); document.removeEventListener('click', closer); }, { once: true }), 0);
      addWrap.appendChild(picker);
    } }, '+ Add Child Entry');
    addWrap.appendChild(addBtn);
    body.appendChild(addWrap);
  }

  card.appendChild(body);
  return card;
}
