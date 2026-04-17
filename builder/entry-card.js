function deepCloneEntry(entry) {
  const clone = { ...entry, _id: uid() };
  if (clone.left)    clone.left    = clone.left.map(deepCloneEntry);
  if (clone.right)   clone.right   = clone.right.map(deepCloneEntry);
  if (clone.entries) clone.entries = clone.entries.map(deepCloneEntry);
  return clone;
}

function renderEntryCard(entry, idx, total, callbacks) {
  const cb        = callbacks || {};
  const meta      = ENTRY_TYPES.find(t => t.type === entry.type);
  const collapsed = collapsedEntries.has(entry._id);

  const card = h("div", { className: "entry-card" + (collapsed ? " entry-card-collapsed" : "") });
  card.style.borderLeftColor = meta?.color || "#ccc";

  
  function silentUpd(field, value) {
    if (cb.onSilentUpd) cb.onSilentUpd(field, value);
    else silentEntryUpdate(idx, field, value);
  }

  function structUpd(field, value) {
    if (cb.onStructUpd) {
      cb.onStructUpd(field, value);
    } else {
      const updated = pg().entries.map((e, i) => i === idx ? { ...e, [field]: value } : e);
      setEntries(updated);
    }
  }

  
  const header = h("div", { className: "entry-header" });
  const icon   = h("span", { className: "palette-icon", style: { background: meta?.color || "#999" } }, meta?.icon || "?");
  header.appendChild(h("span", { className: "entry-type-badge" },
    icon,
    h("span", { style: { color: meta?.color } }, meta?.label || entry.type)
  ));

  if (meta?.hasAlign) header.appendChild(renderAlignGroup(entry.align || "left", v => structUpd("align", v)));

  
  if (meta?.hasFontSize) {
    const defaultFs = DEFAULT_FONT_SIZES[entry.type] || 16;
    const currentFs = entry.fontSize ?? defaultFs;
    const isCustom  = entry.fontSize !== undefined && entry.fontSize !== defaultFs;

    const fsWrap = h("div", { className: "font-size-ctrl" + (isCustom ? " active" : "") });

    fsWrap.appendChild(h("span", { className: "font-size-label" }, "Aa"));

    const fsInp = h("input", {
      className: "font-size-input",
      type:      "number",
      min:       "8",
      max:       "48",
      step:      "1",
      title:     `Font size (default: ${defaultFs}px)`
    });
    fsInp.value = currentFs;
    fsInp.addEventListener("input", e => {
      const v = parseInt(e.target.value);
      if (!isNaN(v) && v >= 8 && v <= 48) {
        fsWrap.classList.toggle("active", v !== defaultFs);
        structUpd("fontSize", v);
      }
    });

    
    const resetBtn = h("button", {
      className: "font-size-reset",
      title:     "Reset to default (" + defaultFs + "px)",
      onClick:   () => {
        fsInp.value = defaultFs;
        fsWrap.classList.remove("active");
        structUpd("fontSize", defaultFs);
      }
    }, "↺");

    fsWrap.appendChild(fsInp);
    if (isCustom) fsWrap.appendChild(resetBtn);
    header.appendChild(fsWrap);
  }

  const acts = h("div", { className: "entry-actions" });

  
  acts.appendChild(h("button", {
    className: "mini-btn collapse-btn" + (collapsed ? " collapsed" : ""),
    title:     collapsed ? "Expand" : "Collapse",
    onClick:   () => {
      if (collapsedEntries.has(entry._id)) collapsedEntries.delete(entry._id);
      else                                  collapsedEntries.add(entry._id);
      render();
    }
  }, collapsed ? "▶" : "▼"));

  
  if (cb.onMoveUp !== undefined) {
    
    acts.appendChild(h("button", { className: "mini-btn move", title: "Move up",   disabled: !cb.onMoveUp,   onClick: () => cb.onMoveUp?.()   }, "↑"));
    acts.appendChild(h("button", { className: "mini-btn move", title: "Move down", disabled: !cb.onMoveDown, onClick: () => cb.onMoveDown?.() }, "↓"));
  } else {
    
    acts.appendChild(h("button", { className: "mini-btn move", title: "Move up",   disabled: idx === 0,
      onClick: () => { const e = [...pg().entries]; [e[idx-1], e[idx]] = [e[idx], e[idx-1]]; setEntries(e); } }, "↑"));
    acts.appendChild(h("button", { className: "mini-btn move", title: "Move down", disabled: idx === total - 1,
      onClick: () => { const e = [...pg().entries]; [e[idx], e[idx+1]] = [e[idx+1], e[idx]]; setEntries(e); } }, "↓"));
  }

  
  if (cb.onDuplicate !== undefined) {
    
    acts.appendChild(h("button", { className: "mini-btn dupe", title: "Duplicate",
      onClick: () => cb.onDuplicate()
    }, "⧉"));
  } else {
    
    acts.appendChild(h("button", { className: "mini-btn dupe", title: "Duplicate",
      onClick: () => {
        const entries = [...pg().entries];
        entries.splice(idx + 1, 0, deepCloneEntry(entry));
        setEntries(entries);
      }
    }, "⧉"));
  }

  
  acts.appendChild(h("button", { className: "mini-btn danger", title: "Remove",
    onClick: cb.onDelete || (() => setEntries(pg().entries.filter((_, i) => i !== idx)))
  }, "×"));

  header.appendChild(acts);
  card.appendChild(header);

  
  if (collapsed) return card;

  const body = h("div", { className: "entry-body" });

  
  if (meta?.hasText) {
    const f = h("div", { className: "field" });
    f.appendChild(h("label", { className: "field-label" }, "Text"));
    if (entry.type === "paragraph") {
      const ta = h("textarea", { className: "textarea", placeholder: "Text content or {{i18n:key}}" });
      ta.value = entry.text || "";
      ta.addEventListener("input", e => silentUpd("text", e.target.value));
      f.appendChild(renderI18nPicker(ta));
    } else {
      const inp = h("input", { className: "input", placeholder: "Text content or {{i18n:key}}" });
      inp.value = entry.text || "";
      inp.addEventListener("input", e => silentUpd("text", e.target.value));
      f.appendChild(renderI18nPicker(inp));
    }
    body.appendChild(f);
  }

  
  if (meta?.hasImage) {
    const row = h("div", { className: "field-row" });

    const f1 = h("div", { className: "field" }); f1.style.flex = "3";
    f1.appendChild(h("label", { className: "field-label" }, "Texture Path"));
    const texInp = h("input", { className: "input", placeholder: "my-image.png" });
    texInp.value = entry.texture || "";
    texInp.addEventListener("input", e => silentUpd("texture", e.target.value));
    f1.appendChild(texInp); row.appendChild(f1);

    const f2 = h("div", { className: "field" }); f2.style.flex = "1";
    f2.appendChild(h("label", { className: "field-label" }, "Scale"));
    const scInp = h("input", { className: "input input-sm", type: "number", step: "0.5", min: "0.1" });
    scInp.value = entry.scale ?? 2;
    scInp.addEventListener("input", e => silentUpd("scale", parseFloat(e.target.value) || 2));
    f2.appendChild(scInp); row.appendChild(f2);
    body.appendChild(row);

    const itemsF = h("div", { className: "field" });
    itemsF.appendChild(h("label", { className: "field-label" }, "Float Items (optional — beside image when left/right)"));
    itemsF.appendChild(renderListItems(entry.items || [], false, (v, structural) => {
      if (structural) structUpd("items", v); else silentUpd("items", v);
    }));
    body.appendChild(itemsF);
  }

  
  if (meta?.hasList) {
    const f = h("div", { className: "field" });
    f.appendChild(h("label", { className: "field-label" }, "Items"));
    f.appendChild(renderListItems(entry.items || [""], entry.type === "orderedList", (v, structural) => {
      if (structural) structUpd("items", v); else silentUpd("items", v);
    }));
    body.appendChild(f);
  }

  
  if (entry.type === "keyValue") {
    const row = h("div", { className: "field-row" });

    const f1 = h("div", { className: "field" });
    f1.appendChild(h("label", { className: "field-label" }, "Key"));
    const ki = h("input", { className: "input", placeholder: "Key" });
    ki.value = entry.key || "";
    ki.addEventListener("input", e => silentUpd("key", e.target.value));
    f1.appendChild(renderI18nPicker(ki)); row.appendChild(f1);

    const f2 = h("div", { className: "field" }); f2.style.flex = "2";
    f2.appendChild(h("label", { className: "field-label" }, "Value"));
    const vi = h("input", { className: "input", placeholder: "Value" });
    vi.value = entry.value || "";
    vi.addEventListener("input", e => silentUpd("value", e.target.value));
    f2.appendChild(renderI18nPicker(vi)); row.appendChild(f2);

    body.appendChild(row);
  }

  
  if (entry.type === "divider") {
    const f = h("div", { className: "field" });
    f.appendChild(h("label", { className: "field-label" }, "Style"));
    const sel = h("select", { className: "select input-sm" });
    DIVIDER_STYLES.forEach(s => {
      const o = h("option", { value: s }, s);
      if (s === (entry.style || "single")) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener("change", e => structUpd("style", e.target.value));
    f.appendChild(sel); body.appendChild(f);
  }

  
  if (entry.type === "spacer") {
    const f = h("div", { className: "field" });
    f.appendChild(h("label", { className: "field-label" }, "Height (px)"));
    const inp = h("input", { className: "input input-sm", type: "number", min: "1" });
    inp.value = entry.height ?? 16;
    inp.addEventListener("input", e => silentUpd("height", parseInt(e.target.value) || 16));
    f.appendChild(inp); body.appendChild(f);
  }

  
  if (meta?.hasSpoiler) {
    
    const lf = h("div", { className: "field" });
    lf.appendChild(h("label", { className: "field-label" }, "Label (header bar text)"));
    const li = h("input", { className: "input", placeholder: "Spoiler" });
    li.value = entry.label || "";
    li.addEventListener("input", e => silentUpd("label", e.target.value));
    lf.appendChild(renderI18nPicker(li));
    body.appendChild(lf);

    
    const cf = h("div", { className: "field" });
    cf.appendChild(h("label", { className: "field-label" }, "Hidden Content"));
    const ca = h("textarea", { className: "textarea", placeholder: "Text shown after the spoiler is clicked..." });
    ca.value = entry.text || "";
    ca.addEventListener("input", e => silentUpd("text", e.target.value));
    cf.appendChild(renderI18nPicker(ca));
    body.appendChild(cf);
  }
  
  if (meta?.hasGif) {
    
    const gifRow1 = h("div", { className: "field-row" });

    const gifTexF = h("div", { className: "field" }); gifTexF.style.flex = "3";
    gifTexF.appendChild(h("label", { className: "field-label" }, "Sprite Sheet Path"));
    const gifTexInp = h("input", { className: "input", placeholder: "animation.png" });
    gifTexInp.value = entry.texture || "";
    gifTexInp.addEventListener("input", e => silentUpd("texture", e.target.value));
    gifTexF.appendChild(gifTexInp); gifRow1.appendChild(gifTexF);

    const gifScF = h("div", { className: "field" }); gifScF.style.flex = "1";
    gifScF.appendChild(h("label", { className: "field-label" }, "Scale"));
    const gifScInp = h("input", { className: "input input-sm", type: "number", step: "0.5", min: "0.1" });
    gifScInp.value = entry.scale ?? 1;
    gifScInp.addEventListener("input", e => silentUpd("scale", parseFloat(e.target.value) || 1));
    gifScF.appendChild(gifScInp); gifRow1.appendChild(gifScF);
    body.appendChild(gifRow1);

    
    const gifRow2 = h("div", { className: "field-row" });

    const gifFcF = h("div", { className: "field" });
    gifFcF.appendChild(h("label", { className: "field-label" }, "Frame Count"));
    const gifFcInp = h("input", { className: "input input-sm", type: "number", min: "1", step: "1" });
    gifFcInp.value = entry.frameCount ?? 1;
    gifFcInp.addEventListener("input", e => structUpd("frameCount", parseInt(e.target.value) || 1));
    gifFcF.appendChild(gifFcInp); gifRow2.appendChild(gifFcF);

    const gifFdF = h("div", { className: "field" });
    gifFdF.appendChild(h("label", { className: "field-label" }, "Frame Duration (s)"));
    const gifFdInp = h("input", { className: "input input-sm", type: "number", step: "0.01", min: "0.016" });
    gifFdInp.value = entry.frameDuration ?? 0.1;
    gifFdInp.addEventListener("input", e => silentUpd("frameDuration", parseFloat(e.target.value) || 0.1));
    gifFdF.appendChild(gifFdInp); gifRow2.appendChild(gifFdF);
    body.appendChild(gifRow2);

    
    const gifRow3 = h("div", { className: "field-row" });

    const gifColsF = h("div", { className: "field" });
    gifColsF.appendChild(h("label", { className: "field-label" }, "Columns (0 = single strip)"));
    const gifColsInp = h("input", { className: "input input-sm", type: "number", min: "0", step: "1" });
    gifColsInp.value = entry.columns ?? 0;
    gifColsInp.addEventListener("input", e => silentUpd("columns", parseInt(e.target.value) || 0));
    gifColsF.appendChild(gifColsInp); gifRow3.appendChild(gifColsF);

    const gifRowsF = h("div", { className: "field" });
    gifRowsF.appendChild(h("label", { className: "field-label" }, "Rows"));
    const gifRowsInp = h("input", { className: "input input-sm", type: "number", min: "1", step: "1" });
    gifRowsInp.value = entry.rows ?? 1;
    gifRowsInp.addEventListener("input", e => silentUpd("rows", parseInt(e.target.value) || 1));
    gifRowsF.appendChild(gifRowsInp); gifRow3.appendChild(gifRowsF);
    body.appendChild(gifRow3);

    
    body.appendChild(h("div", {
      style: { fontSize: "11px", color: "var(--text-dim)", fontFamily: "var(--font-mono)", marginTop: "2px", lineHeight: "1.4" }
    }, ""));
  }

  
  if (meta?.hasLink) {
    // Label field (maps to "text" in JSON — the C# loader reads data.Text as the link label)
    const lf = h("div", { className: "field" });
    lf.appendChild(h("label", { className: "field-label" }, "Label"));
    const li = h("input", { className: "input", placeholder: "Visit Nexus Mods" });
    li.value = entry.text || "";
    li.addEventListener("input", e => silentUpd("text", e.target.value));
    lf.appendChild(renderI18nPicker(li));
    body.appendChild(lf);

    // URL field
    const uf = h("div", { className: "field" });
    uf.appendChild(h("label", { className: "field-label" }, "URL"));
    const urlRow = h("div", { style: { display: "flex", gap: "6px", alignItems: "center" } });
    const ui = h("input", { className: "input", placeholder: "https://" });
    ui.value = entry.url || "";
    ui.addEventListener("input", e => silentUpd("url", e.target.value));
    urlRow.appendChild(ui);

    // Safety badge — mirrors the https/http whitelist in LinkEntry.IsUrlSafe()
    const badge = h("span", {
      style: { fontFamily: "var(--font-mono)", fontSize: "10px", whiteSpace: "nowrap",
               padding: "2px 6px", borderRadius: "3px", flexShrink: "0" }
    });
    function updateBadge(url) {
      const safe = /^https?:\/\//i.test(url);
      badge.textContent  = safe ? "✓ safe" : "✗ unsafe";
      badge.style.background = safe ? "rgba(60,120,60,0.18)" : "rgba(180,60,60,0.18)";
      badge.style.color      = safe ? "#3a8a3a" : "#c03030";
    }
    updateBadge(entry.url || "");
    ui.addEventListener("input", e => updateBadge(e.target.value));
    urlRow.appendChild(badge);
    uf.appendChild(urlRow);

    const urlHint = h("div", {
      style: { fontSize: "10px", color: "var(--text-dim)", fontFamily: "var(--font-mono)",
               marginTop: "3px", lineHeight: "1.4" }
    }, "Only https:// and http:// URLs will open in-game. Other schemes are blocked by GMDF.");
    uf.appendChild(urlHint);
    body.appendChild(uf);
  }

  if (entry.type === "row") {
    
    const fracRow = h("div", { className: "field-row", style: { marginBottom: "8px", alignItems: "center", gap: "8px" } });
    const fracInp = h("input", { type: "range", min: "20", max: "80", step: "5", style: { flex: "1" } });
    fracInp.value = Math.round((entry.leftFraction ?? 0.5) * 100);
    const fracLbl = h("span", { style: { fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text-dim)" } }, fracInp.value + "%");
    fracInp.addEventListener("input", e => {
      const pct = parseInt(e.target.value);
      fracLbl.textContent = pct + "%";
      
      
      silentUpd("leftFraction", pct / 100);
    });
    
    fracInp.addEventListener("change", e => {
      structUpd("leftFraction", parseInt(e.target.value) / 100);
    });
    fracRow.appendChild(fracInp); fracRow.appendChild(fracLbl);
    body.appendChild(fracRow);

    
    function renderColumnEditor(side) {
      const colItems = entry[side] || [];
      const col = h("div", { className: "row-col" });
      col.appendChild(h("div", { className: "row-col-label" }, side === "left" ? "◧ LEFT" : "◨ RIGHT"));

      const entriesEl = h("div", { className: "row-col-entries" });
      colItems.forEach((sub, si) => {
        const subCallbacks = {
          onSilentUpd: (field, value) => {
            entry[side][si] = { ...entry[side][si], [field]: value };
          },
          onStructUpd: (field, value) => {
            const updated = [...entry[side]];
            updated[si] = { ...updated[si], [field]: value };
            structUpd(side, updated);
          },
          onDelete: () => {
            const updated = [...entry[side]];
            updated.splice(si, 1);
            structUpd(side, updated);
          },
          onMoveUp: si > 0 ? () => {
            const updated = [...entry[side]];
            [updated[si-1], updated[si]] = [updated[si], updated[si-1]];
            structUpd(side, updated);
          } : null,
          onMoveDown: si < colItems.length - 1 ? () => {
            const updated = [...entry[side]];
            [updated[si], updated[si+1]] = [updated[si+1], updated[si]];
            structUpd(side, updated);
          } : null,
          onDuplicate: () => {
            const updated = [...entry[side]];
            updated.splice(si + 1, 0, deepCloneEntry(sub));
            structUpd(side, updated);
          },
        };
        entriesEl.appendChild(renderEntryCard(sub, si, colItems.length, subCallbacks));
      });
      col.appendChild(entriesEl);

      
      const addWrap = h("div", { style: { position: "relative" } });
      const addBtn  = h("button", { className: "row-add-btn",
        onClick: evt => {
          evt.stopPropagation();
          document.querySelectorAll(".row-type-picker").forEach(el => el.remove());

          const picker = h("div", { className: "row-type-picker" });
          COLUMN_ENTRY_TYPES.forEach(t => {
            const item = h("div", { className: "row-type-picker-item" });
            item.appendChild(h("span", { className: "palette-icon", style: { background: t.color, width: "16px", height: "16px", fontSize: "10px" } }, t.icon));
            item.appendChild(document.createTextNode(t.label));
            item.addEventListener("click", () => {
              picker.remove();
              structUpd(side, [...(entry[side] || []), defaultEntry(t.type)]);
            });
            picker.appendChild(item);
          });

          setTimeout(() => document.addEventListener("click", function closer() {
            picker.remove();
            document.removeEventListener("click", closer);
          }, { once: true }), 0);

          addWrap.appendChild(picker);
        }
      }, "+ Add to " + side.toUpperCase());

      addWrap.appendChild(addBtn);
      col.appendChild(addWrap);
      return col;
    }

    const cols = h("div", { className: "row-columns" });
    cols.appendChild(renderColumnEditor("left"));
    cols.appendChild(renderColumnEditor("right"));
    body.appendChild(cols);
  }

  if (entry.type === "indentBlock") {
    // Indent amount control
    const indentRow = h("div", { className: "field-row", style: { marginBottom: "8px", alignItems: "center", gap: "8px" } });
    indentRow.appendChild(h("label", { className: "field-label", style: { margin: "0", whiteSpace: "nowrap" } }, "Indent (px)"));
    const indentInp = h("input", { className: "input input-sm", type: "number", min: "0", max: "200", step: "8" });
    indentInp.value = entry.indent ?? 32;
    indentInp.addEventListener("input", e => silentUpd("indent", Math.max(0, parseInt(e.target.value) || 32)));
    indentInp.addEventListener("change", e => structUpd("indent", Math.max(0, parseInt(e.target.value) || 32)));
    // Show rule checkbox — sits to the right of the indent input in the same row
    const ruleCb  = h("input", { type: "checkbox", id: "showRule_" + entry._id, style: { cursor: "pointer" } });
    ruleCb.checked = entry.showRule !== false;
    ruleCb.addEventListener("change", e => structUpd("showRule", e.target.checked));
    const ruleLbl = h("label", { htmlFor: "showRule_" + entry._id, className: "field-label",
      style: { margin: "0", cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" } }, "Show vertical rule");
    indentRow.appendChild(indentInp);
    indentRow.appendChild(ruleCb);
    indentRow.appendChild(ruleLbl);
    body.appendChild(indentRow);

    // Child entries list
    const childItems = entry.entries || [];

    const childEntriesEl = h("div", { className: "row-col-entries" });
    childItems.forEach((sub, si) => {
      const subCallbacks = {
        onSilentUpd: (field, value) => { entry.entries[si] = { ...entry.entries[si], [field]: value }; },
        onStructUpd: (field, value) => {
          const updated = [...entry.entries];
          updated[si] = { ...updated[si], [field]: value };
          structUpd("entries", updated);
        },
        onDelete: () => {
          const updated = [...entry.entries];
          updated.splice(si, 1);
          structUpd("entries", updated);
        },
        onMoveUp: si > 0 ? () => {
          const updated = [...entry.entries];
          [updated[si-1], updated[si]] = [updated[si], updated[si-1]];
          structUpd("entries", updated);
        } : null,
        onMoveDown: si < childItems.length - 1 ? () => {
          const updated = [...entry.entries];
          [updated[si], updated[si+1]] = [updated[si+1], updated[si]];
          structUpd("entries", updated);
        } : null,
        onDuplicate: () => {
          const updated = [...entry.entries];
          updated.splice(si + 1, 0, deepCloneEntry(sub));
          structUpd("entries", updated);
        },
      };
      childEntriesEl.appendChild(renderEntryCard(sub, si, childItems.length, subCallbacks));
    });
    body.appendChild(childEntriesEl);

    // Add child entry picker
    const addWrap = h("div", { style: { position: "relative", marginTop: "6px" } });
    const addBtn  = h("button", { className: "row-add-btn",
      onClick: evt => {
        evt.stopPropagation();
        document.querySelectorAll(".row-type-picker").forEach(el => el.remove());
        const picker = h("div", { className: "row-type-picker" });
        COLUMN_ENTRY_TYPES.forEach(t => {
          const item = h("div", { className: "row-type-picker-item" });
          item.appendChild(h("span", { className: "palette-icon", style: { background: t.color, width: "16px", height: "16px", fontSize: "10px" } }, t.icon));
          item.appendChild(document.createTextNode(t.label));
          item.addEventListener("click", () => {
            picker.remove();
            structUpd("entries", [...(entry.entries || []), defaultEntry(t.type)]);
          });
          picker.appendChild(item);
        });
        setTimeout(() => document.addEventListener("click", function closer() {
          picker.remove();
          document.removeEventListener("click", closer);
        }, { once: true }), 0);
        addWrap.appendChild(picker);
      }
    }, "+ Add Child Entry");
    addWrap.appendChild(addBtn);
    body.appendChild(addWrap);
  }

  card.appendChild(body);
  return card;
}