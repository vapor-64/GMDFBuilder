const gifAnimManager = (() => {
  const intervals = new Set();
  return {
    add(id)   { intervals.add(id); },
    clear()   { intervals.forEach(id => clearInterval(id)); intervals.clear(); },
  };
})();

function renderDivider(style) {
  style = style || "single";

  if (style === "dotted") {
    const c = document.createElement("canvas");
    c.style.cssText = "width:100%;height:10px;display:block;margin:6px 0 8px";
    c.height = 10;
    requestAnimationFrame(() => {
      c.width = c.offsetWidth || 600;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "rgba(180,140,80,0.45)";
      let dx = 0;
      while (dx + 3 <= c.width) { ctx.fillRect(dx, 3, 3, 3); dx += 9; }
    });
    return c;
  }

  if (style === "iconCentered") {
    const wrap = h("div", { className: "pv-divider-icon-wrap" });
    wrap.appendChild(h("div", { className: "pv-divider-icon-line-l" }));
    wrap.appendChild(h("div", { className: "pv-divider-icon-line-r" }));
    wrap.appendChild(h("div", { className: "pv-divider-icon-diamond" }));
    return wrap;
  }

  return h("div", { className: "pv-divider " + style });
}

function renderPreviewImage(entry) {
  const resolved = resolveAsset(entry.texture);
  const scale    = entry.scale || 2;
  const align    = entry.align || "left";
  const hasFloat = (entry.items?.some(i => i?.trim())) && (align === "left" || align === "right");

  if (hasFloat) {
    const wrap   = h("div", { className: "pv-float-wrap" + (align === "right" ? " right" : "") });
    const imgBox = h("div", { className: "pv-float-img" });

    if (resolved) {
      const img = h("img", { src: resolved });
      img.style.imageRendering = "pixelated";
      img.style.display = "block";
      img.addEventListener("load", () => {
        img.style.width  = (img.naturalWidth  * scale) + "px";
        img.style.height = (img.naturalHeight * scale) + "px";
      });
      imgBox.appendChild(img);
    } else {
      imgBox.appendChild(h("div", { className: "pv-image-placeholder", style: { minWidth: "80px" } }, "🖼 " + (entry.texture || "?")));
    }
    wrap.appendChild(imgBox);

    const listBox = h("div", { className: "pv-float-list" });
    const listFs  = entry.fontSize ?? DEFAULT_FONT_SIZES.list;
    (entry.items || []).forEach(item => {
      if (!item?.trim()) return;
      const row = h("div", { className: "pv-list-item" });
      row.appendChild(h("span", { className: "pv-list-bullet" }, "•"));
      const ltxt = h("span", { className: "pv-list-text" });
      ltxt.appendChild(renderInlineContent(item, listFs));
      row.appendChild(ltxt);
      listBox.appendChild(row);
    });
    wrap.appendChild(listBox);
    return wrap;
  }

  
  if (resolved) {
    const img = h("img", { src: resolved });
    img.style.imageRendering = "pixelated";
    img.style.display        = "block";
    img.style.marginBottom   = "8px";
    img.addEventListener("load", () => {
      img.style.width    = (img.naturalWidth  * scale) + "px";
      img.style.height   = (img.naturalHeight * scale) + "px";
      img.style.maxWidth = "100%";
    });
    if (align === "center") { img.style.marginLeft = "auto"; img.style.marginRight = "auto"; }
    else if (align === "right") { img.style.marginLeft = "auto"; }
    return img;
  }

  const ph = h("div", { className: "pv-image-placeholder" }, "🖼 " + (entry.texture || "(no texture)") + " — " + scale + "×");
  if (align === "center") { ph.style.maxWidth = "60%"; ph.style.margin = "0 auto 8px"; }
  if (align === "right")  { ph.style.marginLeft = "auto"; ph.style.maxWidth = "60%"; }
  return ph;
}

function renderPreviewEntry(entry) {
  const align = entry.align || (entry.type === "caption" ? "center" : "left");

  switch (entry.type) {
    case "sectionTitle": {
      const fs = entry.fontSize ?? DEFAULT_FONT_SIZES.sectionTitle;
      const el = h("div", { className: "pv-section-title", style: { textAlign: align, fontSize: fs + "px" } });
      if (entry.anchor) el.dataset.anchor = entry.anchor;
      el.appendChild(renderInlineContent(entry.text || "(empty)", fs));
      return el;
    }

    case "paragraph": {
      const fs = entry.fontSize ?? DEFAULT_FONT_SIZES.paragraph;
      const el = h("div", { className: "pv-paragraph", style: { textAlign: align, fontSize: fs + "px" } });
      if (entry.anchor) el.dataset.anchor = entry.anchor;
      const lines = (entry.text || "(empty)").split('\n');
      lines.forEach((line, li) => {
        el.appendChild(renderInlineContent(line, fs));
        if (li < lines.length - 1) el.appendChild(document.createElement('br'));
      });
      return el;
    }

    case "caption": {
      const fs = entry.fontSize ?? DEFAULT_FONT_SIZES.caption;
      const el = h("div", { className: "pv-caption", style: { textAlign: align, fontSize: fs + "px" } });
      el.appendChild(renderInlineContent(entry.text || "(empty)", fs));
      return el;
    }

    case "image":
      return renderPreviewImage(entry);

    case "gif": {
      const gifAlign    = entry.align || "left";
      const scale       = entry.scale || 1;
      const frameCount  = Math.max(1, entry.frameCount  || 1);
      const frameDurMs  = Math.max(16, (entry.frameDuration || 0.1) * 1000);
      const cols        = entry.columns > 0 ? entry.columns : frameCount;
      const rows        = entry.rows    > 0 ? entry.rows    : 1;
      const resolved    = resolveAsset(entry.texture);

      const wrap = h("div", { style: { marginBottom: "8px" } });

      if (!resolved) {
        const ph = h("div", { className: "pv-image-placeholder" },
          `▶ GIF: ${entry.texture || "(no texture)"} — ${frameCount} frames @ ${entry.frameDuration || 0.1}s`);
        ph.style.fontFamily = "var(--font-mono)";
        if (gifAlign === "center") { ph.style.maxWidth = "70%"; ph.style.margin = "0 auto"; }
        if (gifAlign === "right")  { ph.style.marginLeft = "auto"; ph.style.maxWidth = "70%"; }
        wrap.appendChild(ph);
        return wrap;
      }

      const canvas = document.createElement("canvas");
      canvas.style.imageRendering = "pixelated";
      canvas.style.display = "block";
      if (gifAlign === "center") { canvas.style.marginLeft = "auto"; canvas.style.marginRight = "auto"; }
      if (gifAlign === "right")  { canvas.style.marginLeft = "auto"; }
      wrap.appendChild(canvas);

      
      
      
      const spriteImg = new Image();
      spriteImg.src = resolved;

      let frameIdx = 0;

      const startAnimation = () => {
        const fw = spriteImg.naturalWidth  / cols;
        const fh = spriteImg.naturalHeight / rows;

        canvas.width  = Math.round(fw * scale);
        canvas.height = Math.round(fh * scale);
        canvas.style.width  = canvas.width  + "px";
        canvas.style.height = canvas.height + "px";

        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = false;

        const drawFrame = () => {
          const col = frameIdx % cols;
          const row = Math.floor(frameIdx / cols);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(spriteImg,
            col * fw, row * fh, fw, fh,
            0, 0, canvas.width, canvas.height);
        };

        
        drawFrame();

        
        if (frameCount > 1) {
          const id = setInterval(() => {
            
            
            if (!canvas.isConnected) {
              clearInterval(id);
              gifAnimManager.add(id); 
              return;
            }
            frameIdx = (frameIdx + 1) % frameCount;
            drawFrame();
          }, frameDurMs);

          
          gifAnimManager.add(id);
        }
      };

      if (spriteImg.complete && spriteImg.naturalWidth > 0) {
        
        startAnimation();
      } else {
        spriteImg.addEventListener("load", startAnimation, { once: true });
      }

      return wrap;
    }

    case "list":
    case "orderedList": {
      const fs   = entry.fontSize ?? DEFAULT_FONT_SIZES.list;
      const wrap = h("div", { className: "pv-list-wrap" });
      (entry.items || []).forEach((item, idx) => {
        const row    = h("div", { className: "pv-list-item", style: { fontSize: fs + "px" } });
        const bullet = entry.type === "orderedList" ? (idx + 1) + "." : "•";
        row.appendChild(h("span", { className: "pv-list-bullet" }, bullet));
        const ltxt = h("span", { className: "pv-list-text" });
        ltxt.appendChild(renderInlineContent(item || "(empty)", fs));
        row.appendChild(ltxt);
        wrap.appendChild(row);
      });
      if (align !== "left") wrap.style.textAlign = align;
      return wrap;
    }

    case "keyValue": {
      const fs = entry.fontSize ?? DEFAULT_FONT_SIZES.keyValue;
      const kv = h("div", { className: "pv-kv", style: { fontSize: fs + "px" } });
      const kvKey = h("span", { className: "pv-kv-key" });
      kvKey.appendChild(renderInlineContent(entry.key || "key", fs));
      kv.appendChild(kvKey);
      kv.appendChild(h("span", { className: "pv-kv-arrow" }, "→"));
      const kvVal = h("span", { className: "pv-kv-val" });
      kvVal.appendChild(renderInlineContent(entry.value || "value", fs));
      kv.appendChild(kvVal);
      return kv;
    }

    case "spoiler": {
      
      let revealed = false;

      const wrap = h("div", { style: { marginBottom: "8px" } });

      const headerBar = h("div", {
        style: {
          background: "rgba(100,70,40,0.85)",
          padding: "6px 12px",
          borderRadius: "3px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          userSelect: "none",
        }
      });

      const lbl = h("span", { style: { color: "#fff", fontFamily: "'SVThin',sans-serif", fontSize: "14px" } });
      lbl.appendChild(renderInlineContent(resolveI18n(entry.label) || "(no label)", 14));
      headerBar.appendChild(lbl);

      const contentEl = h("div", {
        style: {
          display: "none",
          background: "rgba(245,230,200,0.6)",
          padding: "8px 12px",
          fontFamily: "'SVThin',sans-serif",
          fontSize: "14px",
          color: "#3e2f1c",
          lineHeight: "1.6",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }
      });
      contentEl.appendChild(renderInlineContent(resolveI18n(entry.text) || "(no content)", 14));

      headerBar.addEventListener("click", () => {
        revealed = !revealed;
        contentEl.style.display = revealed ? "block" : "none";
      });

      wrap.appendChild(headerBar);
      wrap.appendChild(contentEl);
      return wrap;
    }

    case "link": {
      const label   = resolveI18n(entry.text) || "(no label)";
      const url     = entry.url  || "";
      const align   = entry.align || "left";
      const isSafe  = /^https?:\/\//i.test(url);
      const wrap    = h("div", { style: { marginBottom: "4px", textAlign: align } });
      const a       = h("a", {
        style: {
          fontFamily:     "'SVThin', sans-serif",
          fontSize:       "14px",
          color:          isSafe ? "#3250c8" : "#888",
          textDecoration: "underline",
          cursor:         isSafe ? "pointer" : "default",
          opacity:        isSafe ? "1" : "0.5",
        }
      }, label);
      if (isSafe) {
        a.href   = url;
        a.target = "_blank";
        a.rel    = "noopener noreferrer";
      }
      if (!isSafe && url) {
        a.title = `Blocked in-game: scheme is not https:// or http://`;
      }
      wrap.appendChild(a);
      if (!isSafe && url) {
        const warn = h("span", {
          style: { fontSize: "10px", color: "#c03030", fontFamily: "var(--font-mono)", marginLeft: "6px" }
        }, "\u26a0 unsafe scheme \u2014 blocked in-game");
        wrap.appendChild(warn);
      }
      return wrap;
    }

    case "internalLink": {
      const label  = resolveI18n(entry.text) || "(no label)";
      const align  = entry.align || "left";
      const mod    = (entry.mod    || "").trim();
      const page   = (entry.page   || "").trim();
      const anchor = (entry.anchor || "").trim();

      // Determine whether the target is resolvable within the current document
      const isCrossMod = mod.length > 0;
      let resolvable = true;
      if (!isCrossMod) {
        if (page) {
          const pageMatch = state.pages.find(p => {
            const derivedId = (p.id || p.name || "").toLowerCase().replace(/ /g, "-");
            return derivedId === page.toLowerCase();
          });
          resolvable = !!pageMatch;
        }
      }

      const wrap = h("div", { style: { marginBottom: "4px", textAlign: align } });

      const a = h("a", {
        style: {
          fontFamily:     "'SVThin', sans-serif",
          fontSize:       "14px",
          color:          resolvable ? "#1e7a45" : "#888",
          textDecoration: "underline",
          cursor:         "pointer",
          opacity:        resolvable ? "1" : "0.55",
        }
      }, label);

      // In the preview, clicking navigates to the target page if same-mod and resolvable
      if (!isCrossMod && resolvable && page) {
        a.addEventListener("click", e => {
          e.preventDefault();
          const pageIdx = state.pages.findIndex(p => {
            const derivedId = (p.id || p.name || "").toLowerCase().replace(/ /g, "-");
            return derivedId === page.toLowerCase();
          });
          if (pageIdx >= 0) {
            setState({ activePageIdx: pageIdx }, anchor || null);
          }
        });
      }

      wrap.appendChild(a);

      // Destination badge shown below the link
      const parts = [];
      if (isCrossMod)  parts.push("mod: " + mod);
      if (page)        parts.push("page: " + page);
      if (anchor)      parts.push("#" + anchor);
      const badgeText = parts.length ? parts.join("  \u203a  ") : "(no destination set)";
      const badgeColor = resolvable ? "rgba(30,122,69,0.75)" : "rgba(160,80,0,0.75)";

      wrap.appendChild(h("div", {
        style: {
          fontSize: "9px",
          fontFamily: "var(--font-mono)",
          color: badgeColor,
          marginTop: "1px",
          letterSpacing: "0.2px",
        }
      }, badgeText));

      return wrap;
    }

    case "divider":
      return renderDivider(entry.style || "single");

    case "spacer":
      return h("div", { className: "pv-spacer", style: { height: (entry.height || 16) + "px" } });

    case "indentBlock": {
      const indent   = entry.indent ?? 32;
      const showRule = entry.showRule !== false;
      const wrap     = h("div", { style: { display: "flex", alignItems: "stretch", marginBottom: "4px" } });
      if (showRule) {
        const bar = h("div", { style: {
          flexShrink: "0",
          width:      "2px",
          marginLeft: (indent - 2) + "px",
          background: "rgba(180,140,80,0.45)",
          borderRadius: "1px",
        }});
        wrap.appendChild(bar);
      }
      const childWrap = h("div", { style: { flex: "1", minWidth: "0", paddingLeft: showRule ? "10px" : (indent + "px") } });
      (entry.entries || []).forEach(e => childWrap.appendChild(renderPreviewEntry(e)));
      wrap.appendChild(childWrap);
      return wrap;
    }

    case "row": {
      const frac = entry.leftFraction ?? 0.5;
      const wrap = h("div", { className: "pv-row-wrap" });
      const lc   = h("div", { className: "pv-row-col", style: { flex: String(frac) } });
      const rc   = h("div", { className: "pv-row-col", style: { flex: String(1 - frac) } });
      (entry.left  || []).forEach(e => lc.appendChild(renderPreviewEntry(e)));
      (entry.right || []).forEach(e => rc.appendChild(renderPreviewEntry(e)));
      wrap.appendChild(lc); wrap.appendChild(rc);
      return wrap;
    }

    default:
      return h("div", {});
  }
}