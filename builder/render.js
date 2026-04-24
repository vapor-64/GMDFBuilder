function render() {
  gifAnimManager.clear();

  document.documentElement.style.setProperty('--scale', SCALE);

  const app    = document.getElementById("app");
  const scrollY = window.scrollY;
  app.innerHTML = "";
  const page    = pg();

  // ── Sticky header: brand + tab buttons only ───────────────────────────────
  const hdr = h("div", { className: "header" });
  const hl  = h("div", { style: { display: "flex", alignItems: "center", gap: "12px" } });
  const hdrIcon = h("img", {
    src:   "assets/GMDFIcon.png",
    alt:   "GMDF Icon",
    style: { width: "48px", height: "36px", imageRendering: "pixelated", flexShrink: "0" }
  });
  const hdrText = h("div", { className: "header-title-text" });
  hdrText.appendChild(h("h1", {}, "GMDF Documentation Builder"));
  hdrText.appendChild(h("p",  {}, "Build documentation.json visually \u2014 drag, drop, and export"));
  hl.appendChild(hdrIcon);
  hl.appendChild(hdrText);
  hdr.appendChild(hl);

  const ha = h("div", { className: "header-actions" });

  // Save/Reset group
  const hasSave   = !!localStorage.getItem(STORAGE_KEY);
  const saveGroup = h("div", { className: "header-tool-group" });
  saveGroup.appendChild(h("span", {
    className: "autosave-indicator" + (hasSave ? " saved" : ""),
    title:     hasSave ? "Work is auto-saved in this browser" : "Nothing saved yet"
  }, hasSave ? "\u2713 Saved" : "\u25cb Unsaved"));
  if (hasSave) {
    saveGroup.appendChild(h("button", {
      className: "header-tool-btn danger",
      title:     "Clear saved data and reset to a blank document",
      onClick:   () => {
        if (!confirm("Clear all saved data and start fresh?")) return;
        clearPersistedState();
        clearAssets();
        setState({
          modName:       "",
          pages:         [{ _id: uid(), name: "Overview", headerImage: "", entries: [] }],
          activePageIdx: 0,
          view:          "editor",
        });
      }
    }, "\u21ba Reset"));
  }
  ha.appendChild(saveGroup);

  ha.appendChild(h("div", { className: "header-divider" }));

  // Help button — hold to reveal overlay
  const helpBtn = h("button", {
    className:   "help-btn" + (isHelpSeen(HELP_SEEN_HEADER) ? "" : " help-btn-unseen"),
    title:       "Hold for help",
    onMousedown: () => {
      markHelpSeen(HELP_SEEN_HEADER);
      helpBtn.classList.remove("help-btn-unseen");
      const ring = helpBtnWrap.querySelector(".help-orbit-ring");
      if (ring) ring.remove();
      showHelpOverlay();
    },
  }, "?");
  const helpBtnWrap = h("div", { className: "help-btn-wrap" });
  helpBtnWrap.appendChild(helpBtn);
  if (!isHelpSeen(HELP_SEEN_HEADER)) {
    helpBtnWrap.appendChild(h("span", { className: "help-orbit-ring" }));
  }
  ha.appendChild(helpBtnWrap);

  ha.appendChild(h("button", {
    className: "tab-btn",
    style:     { background: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.12)" },
    onClick:   () => showImportModal()
  }, "Import"));
  ["editor", "preview", "json", "validate"].forEach(v => {
    const labels = { editor: "Editor", preview: "Preview", json: "JSON", validate: "Validate" };
    ha.appendChild(h("button", { className: "tab-btn" + (state.view === v ? " active" : ""), onClick: () => setState({ view: v }) }, labels[v]));
  });
  hdr.appendChild(ha);
  app.appendChild(hdr);

  const body = h("div", { className: "app" });

  // ── Editor view ───────────────────────────────────────────────────────────
  if (state.view === "editor") {

    // Hidden file inputs appended to body so they survive re-renders
    const hdrImageInput = document.createElement("input");
    hdrImageInput.type     = "file";
    hdrImageInput.name     = "hdr-image-upload";
    hdrImageInput.multiple = true;
    hdrImageInput.accept   = "image/*";
    hdrImageInput.style.display = "none";
    hdrImageInput.setAttribute("aria-label", "Upload images");
    hdrImageInput.addEventListener("change", e => { addAssetsFromInput(e.target.files); hdrImageInput.value = ""; });
    body.appendChild(hdrImageInput);

    const hdrI18nInput = document.createElement("input");
    hdrI18nInput.type     = "file";
    hdrI18nInput.name     = "hdr-i18n-upload";
    hdrI18nInput.multiple = true;
    hdrI18nInput.accept   = ".json";
    hdrI18nInput.style.display = "none";
    hdrI18nInput.setAttribute("aria-label", "Upload i18n JSON files");
    hdrI18nInput.addEventListener("change", e => mountI18nFiles(e.target.files));
    body.appendChild(hdrI18nInput);

    // ── Toolbar bar: mod name + images + i18n + save/reset + sample ──────────
    const toolBar = h("div", { className: "editor-toolbar" });

    // Mod name
    toolBar.appendChild(h("label", { className: "mod-name-label", htmlFor: "mod-name-input" }, "MOD NAME"));
    const mnInp = h("input", {
      id:          "mod-name-input",
      name:        "mod-name",
      className:   "mod-name-input",
      placeholder: "My Mod Name (or use {{i18nKey}})"
    });
    mnInp.value = state.modName;
    mnInp.addEventListener("input", e => { state.modName = e.target.value; });
    toolBar.appendChild(mnInp);

    // Divider
    toolBar.appendChild(h("div", { className: "header-divider" }));

    // Images group
    const mountGroup = h("div", { className: "header-tool-group img-picker-group" });
    if (assetStore.size > 0) {
      const countBtn = h("button", {
        className: "header-tool-btn active",
        title:     "Show loaded images",
        onClick:   evt => {
          evt.stopPropagation();
          const existing = mountGroup.querySelector(".img-picker-dropdown");
          if (existing) { existing.remove(); return; }
          const dropdown = h("div", { className: "img-picker-dropdown" });
          for (const [fname, { blobUrl }] of assetStore) {
            const row = h("div", { className: "img-picker-row" });
            const thumb = h("img", { className: "img-picker-thumb", src: blobUrl, alt: fname, title: fname });
            row.appendChild(thumb);
            row.appendChild(h("span", { className: "img-picker-name", title: fname }, fname));
            const removeBtn = h("button", {
              className: "img-picker-remove",
              title:     "Remove " + fname,
              onClick:   e => {
                e.stopPropagation();
                URL.revokeObjectURL(blobUrl);
                assetStore.delete(fname);
                if (assetStore.size === 0) { dropdown.remove(); render(); }
                else { row.remove(); countBtn.textContent = `Images (${assetStore.size}) \u25be`; }
              }
            }, "\u2715");
            row.appendChild(removeBtn);
            dropdown.appendChild(row);
          }
          setTimeout(() => {
            function closer(e) {
              if (!mountGroup.contains(e.target)) { dropdown.remove(); document.removeEventListener("mousedown", closer); }
            }
            document.addEventListener("mousedown", closer);
          }, 0);
          mountGroup.appendChild(dropdown);
        }
      }, `Images (${assetStore.size}) \u25be`);
      mountGroup.appendChild(countBtn);
      mountGroup.appendChild(h("button", { className: "header-tool-btn", title: "Add more images", onClick: () => hdrImageInput.click() }, "+"));
      mountGroup.appendChild(h("button", { className: "header-tool-btn danger", title: "Remove all images", onClick: clearAssets }, "\u2715"));
    } else {
      mountGroup.appendChild(h("button", {
        className: "header-tool-btn",
        title:     "Upload images for preview (png, jpg, gif, webp\u2026)",
        onClick:   () => hdrImageInput.click()
      }, "Images"));
    }
    toolBar.appendChild(mountGroup);

    // i18n group
    const i18nGroup = h("div", { className: "header-tool-group" });
    if (i18nStore.size > 0) {
      const i18nSel = h("select", {
        className: "header-tool-btn active",
        style: { cursor: "pointer" },
        onChange: e => { state.activeI18nKey = e.target.value; render(); }
      });
      for (const [filename, { label }] of i18nStore) {
        const opt = document.createElement("option");
        opt.value    = filename;
        opt.text     = "\uD83C\uDF10 " + label;
        opt.selected = filename === state.activeI18nKey;
        i18nSel.appendChild(opt);
      }
      i18nGroup.appendChild(i18nSel);
      i18nGroup.appendChild(h("button", { className: "header-tool-btn", title: "Add more i18n files", onClick: () => hdrI18nInput.click() }, "+"));
      i18nGroup.appendChild(h("button", { className: "header-tool-btn danger", title: "Remove all i18n files", onClick: clearI18n }, "\u2715"));
    } else {
      i18nGroup.appendChild(h("button", {
        className: "header-tool-btn",
        title:     "Upload i18n JSON files (e.g. default.json, fr.json) to preview translations",
        onClick:   () => hdrI18nInput.click()
      }, "\uD83C\uDF10 i18n"));
    }
    toolBar.appendChild(i18nGroup);

    // Sample group — lives in the toolbar next to mod name
    toolBar.appendChild(h("div", { className: "header-divider" }));
    const activeVariantKey   = state.sampleVariantKey || "no-images-no-i18n";
    const activeVariantLabel = SAMPLE_VARIANTS[activeVariantKey]?.label ?? "Sample";
    const sampleGroup = h("div", { className: "header-tool-group sample-picker-group" });
    const sampleLoadBtn = h("button", {
      className: "header-tool-btn",
      style:     { fontWeight: "700" },
      title:     `Load sample: ${activeVariantLabel}`,
      onClick:   () => loadSampleVariant(activeVariantKey)
    }, "Load Sample");
    const sampleChevronBtn = h("button", {
      className: "header-tool-btn sample-chevron-btn",
      title:     `Current: ${activeVariantLabel} \u2014 click to change`,
      onClick:   evt => {
        evt.stopPropagation();
        const existing = sampleGroup.querySelector(".sample-picker-dropdown");
        if (existing) { existing.remove(); return; }
        const dropdown = h("div", { className: "sample-picker-dropdown" });
        dropdown.appendChild(h("div", { className: "sample-picker-header" }, "Load sample as\u2026"));
        Object.entries(SAMPLE_VARIANTS).forEach(([key, variant]) => {
          const isActive = activeVariantKey === key;
          const item = h("div", {
            className: "sample-picker-item" + (isActive ? " active" : ""),
            title:     variant.label,
            onClick:   () => { state.sampleVariantKey = key; dropdown.remove(); render(); }
          }, variant.label);
          dropdown.appendChild(item);
        });
        sampleGroup.appendChild(dropdown);
        // Flip/shift so the dropdown never overflows the viewport
        requestAnimationFrame(() => {
          const r = dropdown.getBoundingClientRect();
          if (r.right > window.innerWidth - 8) {
            dropdown.style.left  = "auto";
            dropdown.style.right = "0";
          }
          if (r.bottom > window.innerHeight - 8) {
            dropdown.style.top    = "auto";
            dropdown.style.bottom = "calc(100% + 4px)";
          }
        });
        setTimeout(() => {
          function closer(e) {
            if (!sampleGroup.contains(e.target)) { dropdown.remove(); document.removeEventListener("mousedown", closer); }
          }
          document.addEventListener("mousedown", closer);
        }, 0);
      }
    }, "\u25be");
    sampleGroup.appendChild(sampleLoadBtn);
    sampleGroup.appendChild(sampleChevronBtn);
    toolBar.appendChild(sampleGroup);

    body.appendChild(toolBar);

    // ── Editor layout ─────────────────────────────────────────────────────────
    const layout = h("div", { className: "editor-layout" });

    const pal = h("div", { className: "palette" });
    pal.appendChild(h("h3",  {}, "Entry Palette"));
    pal.appendChild(h("div", { className: "palette-hint" }, "Drag onto canvas or click to add"));
    ENTRY_TYPES.forEach(t => {
      const item = h("div", { className: "palette-item", draggable: "true" });
      item.style.color = t.color;
      item.addEventListener("dragstart", () => { state.dragType = t.type; });
      item.addEventListener("dragend",   () => setState({ dragType: null, dragOverIdx: null }));
      item.addEventListener("click",     () => setEntries([...page.entries, defaultEntry(t.type)]));
      item.appendChild(h("span", { className: "palette-icon", style: { background: t.color } }, t.icon));
      item.appendChild(document.createTextNode(t.label));
      pal.appendChild(item);
    });
    layout.appendChild(pal);

    const canvas = h("div", { className: "canvas" });

    const tabsScroll = h("div", { className: "page-tabs-scroll" });
    const tabs = h("div", { className: "page-tabs" });

    tabsScroll.addEventListener("wheel", e => {
      if (e.deltaY !== 0) { e.preventDefault(); tabsScroll.scrollLeft += e.deltaY; }
    }, { passive: false });

    state.pages.forEach((pg, i) => {
      const tab = h("div", {
        className: "page-tab" + (i === state.activePageIdx ? " active" : ""),
        onClick:   () => setState({ activePageIdx: i })
      }, pg.name || "Untitled");
      if (state.pages.length > 1) {
        tab.appendChild(h("button", {
          className: "remove-tab",
          onClick: e => {
            e.stopPropagation();
            const np = state.pages.filter((_, j) => j !== i);
            setState({ pages: np, activePageIdx: Math.min(state.activePageIdx, np.length - 1) });
          }
        }, "\u00d7"));
      }
      tabs.appendChild(tab);
    });
    tabs.appendChild(h("button", { className: "add-page-btn", onClick: () => {
      const np = [...state.pages, { _id: uid(), name: `Page ${state.pages.length + 1}`, headerImage: "", entries: [] }];
      setState({ pages: np, activePageIdx: np.length - 1 });
    }}, "+ Page"));

    tabsScroll.appendChild(tabs);
    canvas.appendChild(tabsScroll);

    requestAnimationFrame(() => {
      const activeTab = tabsScroll.querySelector(".page-tab.active");
      if (activeTab) activeTab.scrollIntoView({ block: "nearest", inline: "nearest" });
    });

    const cBody = h("div", { className: "canvas-body" });

    const pSet = h("div", { className: "page-settings" });

    const pgNF = h("div", { className: "field", style: { flex: "1" } });
    pgNF.appendChild(h("label", { className: "field-label" }, "Page Name"));
    const pgNInp = h("input", { className: "input", placeholder: "Page tab label" });
    pgNInp.value = page.name || "";
    pgNInp.addEventListener("input", e => silentPageUpdate(state.activePageIdx, { name: e.target.value }));
    pgNInp.addEventListener("blur",  () => render());
    pgNF.appendChild(pgNInp); pSet.appendChild(pgNF);

    const pgIdF = h("div", { className: "field", style: { flex: "1" } });
    pgIdF.appendChild(h("label", { className: "field-label" }, "Page ID (optional — for internal link targets)"));
    const pgIdInp = h("input", { className: "input", placeholder: "e.g. crafting  (auto-derived from name if blank)" });
    pgIdInp.value = page.id || "";
    pgIdInp.addEventListener("input", e => silentPageUpdate(state.activePageIdx, { id: e.target.value }));
    pgIdInp.addEventListener("blur",  () => render());
    pgIdF.appendChild(pgIdInp); pSet.appendChild(pgIdF);

    const hdrIF = h("div", { className: "field", style: { flex: "2" } });
    hdrIF.appendChild(h("label", { className: "field-label" }, "Header Image (optional)"));
    const hdrIInp = h("input", { className: "input", placeholder: "banner.png" });
    hdrIInp.value = page.headerImage || "";
    hdrIInp.addEventListener("input", e => silentPageUpdate(state.activePageIdx, { headerImage: e.target.value }));
    hdrIF.appendChild(hdrIInp); pSet.appendChild(hdrIF);

    cBody.appendChild(pSet);

    const dz = h("div", { className: "drop-zone " + (state.dragType ? "drag-active" : "drag-inactive") });
    dz.addEventListener("dragover", e => {
      e.preventDefault();
      const ch  = dz.querySelectorAll(".entry-card");
      let ins   = page.entries.length;
      for (let i = 0; i < ch.length; i++) {
        const r = ch[i].getBoundingClientRect();
        if (e.clientY < r.top + r.height / 2) { ins = i; break; }
      }
      if (state.dragOverIdx !== ins) { state.dragOverIdx = ins; render(); }
    });
    dz.addEventListener("dragleave", () => { if (state.dragOverIdx !== null) setState({ dragOverIdx: null }); });
    dz.addEventListener("drop", e => {
      e.preventDefault();
      if (state.dragType) {
        const entries = [...page.entries];
        entries.splice(state.dragOverIdx ?? entries.length, 0, defaultEntry(state.dragType));
        state.dragType    = null;
        state.dragOverIdx = null;
        setEntries(entries);
      }
    });

    if (page.entries.length === 0 && !state.dragType)
      dz.appendChild(h("div", { className: "drop-empty" }, "Drag entries from the palette or click to add them here"));

    page.entries.forEach((entry, idx) => {
      if (state.dragOverIdx === idx && state.dragType) dz.appendChild(h("div", { className: "drop-indicator" }));
      dz.appendChild(renderEntryCard(entry, idx, page.entries.length));
    });
    if (state.dragOverIdx === page.entries.length && state.dragType)
      dz.appendChild(h("div", { className: "drop-indicator" }));

    cBody.appendChild(dz);
    canvas.appendChild(cBody);
    layout.appendChild(canvas);
    body.appendChild(layout);
  }

  // ── Preview view ──────────────────────────────────────────────────────────
  if (state.view === "preview") {
    const panel = h("div", { className: "preview-panel", style: { minHeight: "calc(100vh - 140px)" } });

    if (i18nStore.size > 0) {
      const i18nBar = h("div", { className: "asset-bar", style: { marginBottom: "4px", gap: "6px" } });
      i18nBar.appendChild(h("span", { style: { fontSize: "12px", opacity: "0.75", fontFamily: "var(--font-mono)" } }, "\uD83C\uDF10 Preview language:"));
      const sel = h("select", {
        className: "mount-btn",
        style: { cursor: "pointer" },
        onChange: e => { state.activeI18nKey = e.target.value; render(); }
      });
      for (const [filename, { label }] of i18nStore) {
        const opt = document.createElement("option");
        opt.value    = filename;
        opt.text     = label;
        opt.selected = filename === state.activeI18nKey;
        sel.appendChild(opt);
      }
      i18nBar.appendChild(sel);
      panel.appendChild(i18nBar);
    }

    const noticeKey = "gmdf_preview_notice_dismissed";
    if (!sessionStorage.getItem(noticeKey)) {
      const notice = h("div", { className: "pv-proportion-notice" });
      notice.appendChild(h("span", { className: "pv-proportion-notice-icon" }, "\u2139"));
      const msg = h("span", { className: "pv-proportion-notice-text" });
      msg.innerHTML = "<strong>Visual proportions differ in-game.</strong> Font size, line spacing, and content width vary depending on the player's screen resolution and UI scale. Use this preview as a <em>structural reference</em> \u2014 test font sizes and spacing directly in-game to fine-tune final values.";
      notice.appendChild(msg);
      const dismissBtn = h("button", {
        className: "pv-proportion-notice-dismiss",
        title:     "Dismiss for this session",
        onClick:   () => { sessionStorage.setItem(noticeKey, "1"); notice.remove(); }
      }, "\u2715");
      notice.appendChild(dismissBtn);
      panel.appendChild(notice);
    }

    const chrome = h("div", { className: "pv-chrome" });
    chrome.appendChild(h("div", { className: "pv-chrome-title" }, "Mod Documentation"));
    panel.appendChild(chrome);

    const pvLayout = h("div", { className: "pv-layout", style: { minHeight: "calc(100vh - 210px)" } });

    const sidebar = h("div", { className: "pv-sidebar" });
    sidebar.appendChild(h("div", { className: "pv-sidebar-item active" }, resolveI18n(state.modName) || "My Mod"));
    pvLayout.appendChild(sidebar);

    const main = h("div", { className: "pv-main" });

    const tabsRow = h("div", { style: { display: "flex", gap: "3px", marginBottom: "4px", alignItems: "flex-end" } });
    state.pages.forEach((p, i) => {
      tabsRow.appendChild(h("div", {
        className: "pv-chrome-tab" + (i === state.activePageIdx ? " active" : ""),
        onClick:   () => setState({ activePageIdx: i })
      }, resolveI18n(p.name) || "Untitled"));
    });
    main.appendChild(tabsRow);

    const contentWrap = h("div", { className: "pv-content-wrap", style: { flex: "1", minHeight: "400px" } });
    const content     = h("div", { className: "pv-content" });

    if (page.headerImage?.trim()) {
      const resolvedHdr = resolveAsset(page.headerImage);
      if (resolvedHdr) {
        const hdrImg = h("img", { src: resolvedHdr });
        hdrImg.style.cssText = "width:100%;display:block;margin-bottom:8px;image-rendering:pixelated";
        content.appendChild(hdrImg);
      } else {
        content.appendChild(h("div", { className: "pv-image-placeholder", style: { marginBottom: "8px", padding: "20px" } }, "\uD83D\uDDBC Header: " + page.headerImage));
      }
    }

    page.entries.forEach(e => content.appendChild(renderPreviewEntry(e)));
    if (!page.entries.length && !page.headerImage?.trim())
      content.appendChild(h("div", { style: { textAlign: "center", color: "rgba(62,47,28,0.4)", padding: "40px", fontSize: "13px", fontFamily: "var(--font-body)" } }, "No entries yet."));

    contentWrap.appendChild(content);
    main.appendChild(contentWrap);
    pvLayout.appendChild(main);
    panel.appendChild(pvLayout);
    body.appendChild(panel);
  }

  // ── JSON view ─────────────────────────────────────────────────────────────
  if (state.view === "json") {
    const panel   = h("div", { className: "json-panel" });
    const jsonStr = generateJson();
    const toolbar = h("div", { className: "json-toolbar" });
    toolbar.appendChild(h("button", {
      className: "copy-btn" + (state.copyLabel === "Copied!" ? " copied" : ""),
      title:     "Copy to clipboard",
      onClick:   () => {
        navigator.clipboard?.writeText(jsonStr);
        setState({ copyLabel: "Copied!" });
        setTimeout(() => setState({ copyLabel: "Copy JSON" }), 2000);
      }
    }, state.copyLabel));
    toolbar.appendChild(h("button", {
      className: "copy-btn",
      title:     "Download as documentation.json",
      onClick:   () => {
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        a.href     = url;
        a.download = "documentation.json";
        a.click();
        URL.revokeObjectURL(url);
      }
    }, "\u2193 Download"));
    panel.appendChild(toolbar);
    panel.appendChild(h("pre", {}, jsonStr));
    body.appendChild(panel);
  }

  // ── Validate view ─────────────────────────────────────────────────────────
  if (state.view === "validate") {
    const panel = h("div", { className: "validate-panel" });
    panel.appendChild(h("h3", {}, "Validation Results"));
    const iss = validate();
    if (!iss.length)
      panel.appendChild(h("div", { className: "issue ok" }, "\u2713 No issues found. Your documentation.json is valid!"));
    else
      iss.forEach(i => panel.appendChild(h("div", { className: "issue " + i.level }, (i.level === "error" ? "\u2717 " : "\u26a0 ") + i.msg)));
    body.appendChild(panel);
  }

  app.appendChild(body);

  if (_pendingAnchor) {
    const anchor = _pendingAnchor;
    _pendingAnchor = null;
    // Two rAFs to let layout + image loads settle, then position the target.
    // In preview mode the real scroll container is an inner .pv-content element
    // (overflow-y:auto); at small window sizes it overflows and we can scroll
    // it. At large window sizes the content fits entirely and there is nothing
    // to scroll — in that case we simply flash the target so the user sees
    // where the link landed. We deliberately do NOT scroll the window, because
    // the document itself has no relation to the target's visual position.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const target = document.querySelector(`[data-anchor="${anchor}"]`);
      if (!target) return;

      const scroller = findScrollableAncestor(target);
      if (scroller && scroller !== document.scrollingElement &&
          scroller !== document.documentElement && scroller !== document.body) {
        // Inner container that actually overflows — scroll it.
        const tRect = target.getBoundingClientRect();
        const sRect = scroller.getBoundingClientRect();
        const desired = (tRect.top - sRect.top) + scroller.scrollTop - 16;
        scroller.scrollTo({ top: Math.max(0, desired), behavior: "instant" });
      }
      // Always flash the target, regardless of whether we scrolled. This
      // provides a visual cue when no scroll was needed (large window) and
      // also reinforces the landing spot when scrolling did happen.
      flashAnchorTarget(target);
    }));
  } else {
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo({ top: scrollY, behavior: "instant" })));
  }
}

// Walk up the ancestor chain and return the first element whose computed
// overflowY is auto/scroll/overlay AND which is actually overflowing. Falls
// back to the document scrolling element if nothing else qualifies.
function findScrollableAncestor(el) {
  let node = el.parentElement;
  while (node && node !== document.body && node !== document.documentElement) {
    const oy = getComputedStyle(node).overflowY;
    const scrollable = oy === "auto" || oy === "scroll" || oy === "overlay";
    if (scrollable && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

// Briefly highlight an anchor target so the user can see where an internal
// link landed, even if no scrolling was required.
function flashAnchorTarget(el) {
  el.classList.remove("pv-anchor-flash"); // restart animation if re-triggered
  // Force reflow so removing + re-adding the class actually restarts the anim.
  void el.offsetWidth;
  el.classList.add("pv-anchor-flash");
  setTimeout(() => el.classList.remove("pv-anchor-flash"), 1600);
}

render();
