function h(tag, attrs, ...ch) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "className")                    el.className = v;
      else if (k.startsWith("on"))              el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
      else if (k === "disabled")                el.disabled = !!v;
      else                                      el.setAttribute(k, v);
    }
  }
  for (const c of ch) {
    if (c == null) continue;
    el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  }
  return el;
}

function renderAlignGroup(current, onChange) {
  const g = h("div", { className: "align-group" });
  ALIGNS.forEach(a => {
    const b = h(
      "button",
      { className: "align-btn" + (current === a ? " active" : ""), onClick: () => onChange(a) },
      a === "left" ? "◧" : a === "center" ? "◫" : "◨"
    );
    b.title           = a[0].toUpperCase() + a.slice(1);
    b.dataset.tooltip = a[0].toUpperCase() + a.slice(1);
    g.appendChild(b);
  });
  return g;
}

function renderI18nPicker(inputEl) {
  const wrap = h("div", { className: "i18n-picker-wrap" });
  wrap.appendChild(inputEl);

  
  if (i18nStore && i18nStore.size > 0) {
    const data = getActiveI18nData();
    const keys = Object.keys(data);
    if (keys.length) {
      const btn = h("button", {
        className: "i18n-picker-btn",
        title: "Insert i18n tag",
        type: "button",
        onClick: evt => {
          evt.stopPropagation();
          document.querySelectorAll(".i18n-picker-dropdown").forEach(el => el.remove());

          const dropdown = h("div", { className: "i18n-picker-dropdown" });
          keys.forEach(key => {
            const val  = data[key];
            const item = h("div", { className: "i18n-picker-item" });
            item.appendChild(h("span", { className: "i18n-picker-key" }, key));
            item.appendChild(h("span", { className: "i18n-picker-val" }, val));
            item.addEventListener("click", e => {
              e.stopPropagation();
              const tag   = `{{i18n:${key}}}`;
              const start = inputEl.selectionStart ?? inputEl.value.length;
              const end   = inputEl.selectionEnd   ?? inputEl.value.length;
              inputEl.value = inputEl.value.slice(0, start) + tag + inputEl.value.slice(end);
              const newPos  = start + tag.length;
              inputEl.setSelectionRange(newPos, newPos);
              inputEl.dispatchEvent(new Event("input", { bubbles: true }));
              inputEl.focus();
              dropdown.remove();
            });
            dropdown.appendChild(item);
          });
          setTimeout(() => document.addEventListener("click", function closer() {
            dropdown.remove();
            document.removeEventListener("click", closer);
          }, { once: true }), 0);
          wrap.appendChild(dropdown);
        }
      }, "🌐");
      wrap.appendChild(btn);
    }
  }

  
  attachSpritePicker(inputEl, wrap);

  return wrap;
}

function _getSpriteGroups() {
  const sprites  = window.GMDF_SPRITES || {};
  const groups   = {};   
  for (const fullKey of Object.keys(sprites)) {
    const colon = fullKey.indexOf(":");
    if (colon < 0) continue;
    const qualifier = fullKey.slice(0, colon);
    const id        = fullKey.slice(colon + 1);
    if (!groups[qualifier]) groups[qualifier] = [];
    groups[qualifier].push({ key: fullKey, qualifier, id, dataUri: sprites[fullKey] });
  }
  
  for (const q of Object.keys(groups)) {
    groups[q].sort((a, b) => {
      const na = parseInt(a.id), nb = parseInt(b.id);
      return (isNaN(na) || isNaN(nb)) ? a.id.localeCompare(b.id) : na - nb;
    });
  }
  return groups;
}

function _insertSpriteToken(inputEl, qualifier, id) {
  const tag   = `[(${qualifier})${id}]`;
  const start = inputEl.selectionStart ?? inputEl.value.length;
  const end   = inputEl.selectionEnd   ?? inputEl.value.length;
  inputEl.value = inputEl.value.slice(0, start) + tag + inputEl.value.slice(end);
  const newPos  = start + tag.length;
  inputEl.setSelectionRange(newPos, newPos);
  inputEl.dispatchEvent(new Event("input", { bubbles: true }));
  inputEl.focus();
}

function _makeSpriteCell(entry, onClick, size) {
  size = size || 32;
  const cell = h("div", { className: "sp-cell", title: `[(${entry.qualifier})${entry.id}]` });
  const img  = document.createElement("img");
  img.src              = entry.dataUri;
  img.className        = "sp-cell-img";
  img.style.width      = size + "px";
  img.style.height     = size + "px";
  img.style.imageRendering = "pixelated";
  img.addEventListener("load", () => {
    if (img.naturalHeight > 0) {
      const scale     = size / img.naturalHeight;
      img.style.width = Math.round(img.naturalWidth * scale) + "px";
    }
  });
  cell.appendChild(img);
  cell.appendChild(h("span", { className: "sp-cell-label" }, entry.id));
  cell.addEventListener("mousedown", e => { e.preventDefault(); onClick(entry); });
  return cell;
}

function attachSpritePicker(inputEl, wrap) {
  if (!window.GMDF_SPRITES || !Object.keys(window.GMDF_SPRITES).length) return;

  const groups     = _getSpriteGroups();
  const qualifiers = Object.keys(groups).sort();
  if (!qualifiers.length) return;

  
  const toolbarBtn = h("button", {
    className:      "sp-toolbar-btn",
    title:          "Insert sprite",
    "data-tooltip": "Insert sprite",
    type:           "button",
    onClick:   evt => {
      evt.stopPropagation();
      
      document.querySelectorAll(".sp-panel").forEach(el => el.remove());

      const panel = h("div", { className: "sp-panel" });

      
      const header = h("div", { className: "sp-panel-header" });

      const searchInp = h("input", {
        className:   "sp-search",
        type:        "search",
        placeholder: "Search sprites…",
      });
      header.appendChild(searchInp);

      const closeBtn = h("button", { className: "sp-panel-close", type: "button", title: "Close" }, "×");
      closeBtn.addEventListener("mousedown", e => { e.preventDefault(); panel.remove(); });
      header.appendChild(closeBtn);
      panel.appendChild(header);

      
      const tabBar  = h("div", { className: "sp-tab-bar" });
      const gridWrap = h("div", { className: "sp-grid-wrap" });
      let activeQ   = qualifiers[0];

      function showTab(q) {
        activeQ = q;
        
        tabBar.querySelectorAll(".sp-tab").forEach(t =>
          t.classList.toggle("active", t.dataset.q === q)
        );
        buildGrid(q, searchInp.value.trim());
      }

      qualifiers.forEach(q => {
        const tab = h("button", { className: "sp-tab" + (q === activeQ ? " active" : ""), type: "button" }, q);
        tab.dataset.q = q;
        tab.addEventListener("mousedown", e => { e.preventDefault(); showTab(q); });
        tabBar.appendChild(tab);
      });
      panel.appendChild(tabBar);

      
      const countEl = h("div", { className: "sp-count" });
      panel.appendChild(countEl);
      panel.appendChild(gridWrap);

      function buildGrid(q, filter) {
        gridWrap.innerHTML = "";
        let entries = groups[q] || [];
        if (filter) {
          const f = filter.toLowerCase();
          entries  = entries.filter(e => e.id.toLowerCase().includes(f) ||
                                        e.qualifier.toLowerCase().includes(f));
        }
        countEl.textContent = `${entries.length} of ${(groups[q]||[]).length} sprites`;
        if (!entries.length) {
          gridWrap.appendChild(h("div", { className: "sp-empty" }, "No sprites match"));
          return;
        }
        const grid = h("div", { className: "sp-grid" });
        entries.forEach(entry => {
          grid.appendChild(_makeSpriteCell(entry, e => {
            _insertSpriteToken(inputEl, e.qualifier, e.id);
            panel.remove();
          }, 32));
        });
        gridWrap.appendChild(grid);
      }

      buildGrid(activeQ, "");

      searchInp.addEventListener("input", e => buildGrid(activeQ, e.target.value.trim()));

      
      setTimeout(() => {
        function closer(e) {
          if (!panel.contains(e.target) && e.target !== toolbarBtn) {
            panel.remove();
            document.removeEventListener("mousedown", closer);
          }
        }
        document.addEventListener("mousedown", closer);
      }, 0);

      
      wrap.appendChild(panel);
      requestAnimationFrame(() => searchInp.focus());
    }
  }, "▣");

  wrap.appendChild(toolbarBtn);

  
  
  

  let inlinePopup = null;
  let inlineSelIdx = 0;

  function closeInlinePopup() {
    if (inlinePopup) { inlinePopup.remove(); inlinePopup = null; }
    inlineSelIdx = 0;
  }

  
  function getPartialToken() {
    const val    = inputEl.value;
    const cursor = inputEl.selectionStart ?? val.length;
    
    const open   = val.lastIndexOf("[(", cursor);
    if (open < 0) return null;
    
    const between = val.slice(open, cursor);
    if (between.includes("]")) return null;
    return { partial: between.slice(2), start: open }; 
  }

  function buildInlinePopup(partialToken, anchorStart) {
    closeInlinePopup();

    
    let qFilter = "", idFilter = "";
    const paren = partialToken.indexOf(")");
    if (paren < 0) {
      qFilter = partialToken.toUpperCase();
    } else {
      qFilter  = partialToken.slice(0, paren).toUpperCase();
      idFilter = partialToken.slice(paren + 1).toLowerCase();
    }

    
    const results = [];
    for (const q of qualifiers) {
      if (qFilter && !q.startsWith(qFilter)) continue;
      for (const entry of (groups[q] || [])) {
        if (idFilter && !entry.id.toLowerCase().startsWith(idFilter)) continue;
        results.push(entry);
        if (results.length >= 24) break;
      }
      if (results.length >= 24) break;
    }

    if (!results.length) return;

    const popup = h("div", { className: "sp-inline-popup" });
    inlinePopup  = popup;
    inlineSelIdx = 0;

    function renderRows() {
      popup.innerHTML = "";
      results.forEach((entry, i) => {
        const row = h("div", { className: "sp-inline-row" + (i === inlineSelIdx ? " selected" : "") });
        const img = document.createElement("img");
        img.src              = entry.dataUri;
        img.className        = "sp-inline-img";
        img.style.imageRendering = "pixelated";
        img.addEventListener("load", () => {
          if (img.naturalHeight > 0) {
            img.style.width = Math.round(img.naturalWidth * (20 / img.naturalHeight)) + "px";
          }
        });
        row.appendChild(img);
        row.appendChild(h("span", { className: "sp-inline-token" }, `[(${entry.qualifier})${entry.id}]`));
        row.addEventListener("mousedown", e => {
          e.preventDefault();
          commitInline(entry, anchorStart);
        });
        popup.appendChild(row);
      });
    }

    function commitInline(entry, anchorStart) {
      const tag    = `[(${entry.qualifier})${entry.id}]`;
      const cursor = inputEl.selectionStart ?? inputEl.value.length;
      
      inputEl.value = inputEl.value.slice(0, anchorStart) + tag + inputEl.value.slice(cursor);
      const newPos  = anchorStart + tag.length;
      inputEl.setSelectionRange(newPos, newPos);
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      closeInlinePopup();
      inputEl.focus();
    }

    renderRows();
    wrap.appendChild(popup);

    
    function onKey(e) {
      if (!inlinePopup) return;
      if (e.key === "ArrowDown")  { e.preventDefault(); inlineSelIdx = Math.min(inlineSelIdx + 1, results.length - 1); renderRows(); }
      if (e.key === "ArrowUp")    { e.preventDefault(); inlineSelIdx = Math.max(inlineSelIdx - 1, 0); renderRows(); }
      if (e.key === "Enter")      { e.preventDefault(); commitInline(results[inlineSelIdx], anchorStart); }
      if (e.key === "Escape")     { e.preventDefault(); closeInlinePopup(); }
    }
    inputEl.addEventListener("keydown", onKey);
    
    const observer = new MutationObserver(() => {
      if (!document.contains(popup)) {
        inputEl.removeEventListener("keydown", onKey);
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  }

  inputEl.addEventListener("input", () => {
    const tok = getPartialToken();
    if (!tok) { closeInlinePopup(); return; }
    
    buildInlinePopup(tok.partial, tok.start);
  });

  inputEl.addEventListener("blur", () => {
    
    setTimeout(closeInlinePopup, 150);
  });
}

function renderListItems(items, isOrdered, onChange) {
  const w = h("div", {});
  const safeItems = items || [""];

  safeItems.forEach((item, idx) => {
    const row = h("div", { className: "list-item" });
    row.appendChild(h("span", { className: "bullet" }, isOrdered ? `${idx + 1}.` : "•"));

    const inp = h("input", {
      className:   "input",
      placeholder: `Item ${idx + 1}`,
      value:       item
    });
    inp.addEventListener("input", e => {
      safeItems[idx] = e.target.value;
      onChange([...safeItems], false); 
    });
    row.appendChild(renderI18nPicker(inp));

    const delBtn = h("button", {
      className: "mini-btn danger",
      title:     "Remove",
      disabled:  safeItems.length <= 1,
      onClick:   e => {
        e.preventDefault();
        onChange(safeItems.filter((_, i) => i !== idx), true); 
      }
    }, "×");
    row.appendChild(delBtn);
    w.appendChild(row);
  });

  w.appendChild(h("button", {
    className: "add-item-btn",
    onClick:   () => onChange([...safeItems, ""], true) 
  }, "+ Add Item"));

  return w;
}