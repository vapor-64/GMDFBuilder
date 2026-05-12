function serializeEntry(e) {
  const r = { type: e.type };
  if (e.text  !== undefined) r.text  = e.text;
  if (e.label !== undefined) r.label = e.label;
  // anchor field — written for sectionTitle and paragraph when set
  if (["sectionTitle", "paragraph"].includes(e.type) && e.anchor?.trim())
    r.anchor = e.anchor.trim();
  
  if (e.align && !(e.type === "caption" && e.align === "center") && e.align !== "left") r.align = e.align;
  
  if (e.fontSize !== undefined && e.fontSize !== DEFAULT_FONT_SIZES[e.type])
    r.fontSize = e.fontSize;
  if (e.texture !== undefined) r.texture = e.texture;
  if (e.scale   !== undefined && e.scale !== 2) r.scale = e.scale;
  if (e.type === "image" && e.items?.length && e.items.some(i => i.trim())) r.items = e.items;
  if ((e.type === "list" || e.type === "orderedList") && e.items) r.items = e.items;
  if (e.key   !== undefined) r.key   = e.key;
  if (e.value !== undefined) r.value = e.value;
  if (e.style  && e.style !== "single") r.style  = e.style;
  if (e.height !== undefined && e.height !== 16) r.height = e.height;
  if (e.type === "row") {
    r.left  = (e.left  || []).map(serializeEntry);
    r.right = (e.right || []).map(serializeEntry);
    if (e.leftFraction !== undefined && Math.abs(e.leftFraction - 0.5) > 0.001)
      r.leftFraction = e.leftFraction;
  }
  if (e.type === "indentBlock") {
    r.entries = (e.entries || []).map(serializeEntry);
    if (e.indent !== undefined && e.indent !== 32) r.indent = e.indent;
    if (e.showRule === false) r.showRule = false;
  }
  if (e.type === "spoiler") {
    // Always serialize child entries. If the spoiler was created with the old
    // plain-text form (e.text) and has no entries array, wrap the text in a
    // paragraph entry so the output is always the new schema.
    const kids = e.entries && e.entries.length > 0
      ? e.entries
      : (e.text?.trim() ? [{ _id: uid(), type: "paragraph", text: e.text }] : []);
    r.entries = kids.map(serializeEntry);
    // Never write the legacy "text" field on spoilers.
    delete r.text;
  }
  if (e.type === "gif") {
    r.frameCount    = e.frameCount    ?? 1;
    r.frameDuration = e.frameDuration ?? 0.1;
    if (e.columns && e.columns > 0) r.columns = e.columns;
    if (e.rows && e.rows > 1)       r.rows    = e.rows;
  }
  if (e.type === "link" && e.url !== undefined) r.url = e.url;
  if (e.type === "internalLink") {
    if (e.anchor?.trim()) r.anchor = e.anchor.trim();
    if (e.page?.trim())   r.page   = e.page.trim();
    if (e.mod?.trim())    r.mod    = e.mod.trim();
  }
  return r;
}

function generateJson() {
  return JSON.stringify({
    $schema: "https://raw.githubusercontent.com/vapor64/GMDF/master/documentation.schema.json",
    format:  1,
    modName: state.modName || "My Mod",
    pages: state.pages.map(p => {
      const o = { name: p.name || "Untitled" };
      if (p.id?.trim()) o.id = p.id.trim();
      if (p.headerImage?.trim()) o.headerImage = { texture: p.headerImage };
      o.entries = p.entries.map(e => serializeEntry(e));
      return o;
    })
  }, null, 2);
}

// ── Multi-file output ─────────────────────────────────────────────────────────

/**
 * Derives the page file slug from a page object.
 * Uses the explicit id field if set, otherwise slugifies the page name.
 */
function pageSlug(p) {
  if (p.id?.trim()) return p.id.trim().toLowerCase().replace(/\s+/g, "-");
  return (p.name || "page").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "page";
}

/**
 * Returns an object mapping filename → JSON string for the documentation/ folder.
 * Files:
 *   documentation/documentation.json          — manifest
 *   documentation/documentation.<slug>.json   — one per page
 */
function generateMultiFileOutput() {
  const files = {};

  // Compute slugs, deduplicating if two pages would collide.
  const usedSlugs = new Map(); // slug → count
  const slugs = state.pages.map(p => {
    let base = pageSlug(p);
    const n  = (usedSlugs.get(base) || 0) + 1;
    usedSlugs.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });

  // Manifest — modName, format, and pageOrder.
  const manifest = {
    $schema: "https://raw.githubusercontent.com/vapor64/GMDF/master/documentation.schema.json",
    format:  1,
    modName: state.modName || "My Mod",
    pageOrder: slugs,
  };
  files["documentation/documentation.json"] = JSON.stringify(manifest, null, 2);

  // Per-page files.
  state.pages.forEach((p, i) => {
    const slug = slugs[i];
    const pageObj = {
      id:      slug,
      name:    p.name || "Untitled",
    };
    if (p.headerImage?.trim()) pageObj.headerImage = { texture: p.headerImage };
    pageObj.entries = p.entries.map(e => serializeEntry(e));
    files[`documentation/documentation.${slug}.json`] = JSON.stringify(pageObj, null, 2);
  });

  return files;
}

/**
 * Triggers individual file downloads for each file in the multi-file layout.
 * Files are downloaded one at a time with a short delay so browsers don't
 * block them as a popup storm.
 */
function downloadMultiFileZip() {
  const files = generateMultiFileOutput();
  const entries = Object.entries(files);
  entries.forEach(([path, content], i) => {
    setTimeout(() => {
      const blob = new Blob([content], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      // Use only the bare filename so the browser saves it flat;
      // the user places the files into the documentation/ folder themselves.
      a.download = path.split('/').pop();
      a.href     = url;
      a.click();
      URL.revokeObjectURL(url);
    }, i * 120);
  });
}

function validate() {
  const iss = [];
  if (!state.modName?.trim())
    iss.push({ level: "error", msg: "Mod name is required." });

  function validateEntry(e, loc) {
    if (["sectionTitle", "paragraph", "caption"].includes(e.type) && !e.text?.trim())
      iss.push({ level: "error", msg: `${loc}: Text is empty.` });
    if (e.type === "image" && !e.texture?.trim())
      iss.push({ level: "error", msg: `${loc}: Texture path is empty.` });
    if (e.type === "gif") {
      if (!e.texture?.trim())
        iss.push({ level: "error", msg: `${loc}: Sprite sheet path is empty.` });
      if (!e.frameCount || e.frameCount < 1)
        iss.push({ level: "error", msg: `${loc}: frameCount must be at least 1.` });
      if (e.columns > 0 && e.rows > 0 && e.columns * e.rows < e.frameCount)
        iss.push({ level: "warn", msg: `${loc}: columns × rows (${e.columns * e.rows}) is less than frameCount (${e.frameCount}) — some frames will be unreachable.` });
    }
    if (["list", "orderedList"].includes(e.type)) {
      if (!e.items?.length)
        iss.push({ level: "error", msg: `${loc}: No items.` });
      else
        e.items.forEach((it, ii) => {
          if (!it?.trim()) iss.push({ level: "warn", msg: `${loc}, item ${ii + 1}: Empty.` });
        });
    }
    if (e.type === "keyValue") {
      if (!e.key?.trim())   iss.push({ level: "error", msg: `${loc}: Key is empty.` });
      if (!e.value?.trim()) iss.push({ level: "warn",  msg: `${loc}: Value is empty.` });
    }
    if (e.type === "link") {
      if (!e.text?.trim()) iss.push({ level: "error", msg: `${loc}: Label is empty.` });
      if (!e.url?.trim())  iss.push({ level: "error", msg: `${loc}: URL is empty.` });
      else if (!/^https?:\/\//i.test(e.url))
        iss.push({ level: "warn", msg: `${loc}: URL scheme is not https:// or http:// \u2014 link will be blocked in-game.` });
    }
    if (e.type === "internalLink") {
      if (!e.text?.trim()) iss.push({ level: "error", msg: `${loc}: Label is empty.` });
      const hasTarget = e.mod?.trim() || e.page?.trim() || e.anchor?.trim();
      if (!hasTarget)
        iss.push({ level: "error", msg: `${loc}: Must specify at least one of: mod, page, anchor.` });
    }
    if (e.type === "indentBlock") {
      if (!e.entries?.length)
        iss.push({ level: "warn", msg: `${loc}: Indent block has no child entries.` });
      else
        e.entries.forEach((child, ci) => validateEntry(child, `${loc} > child ${ci + 1} (${child.type})`));
    }
    if (e.type === "spoiler") {
      if (!e.label?.trim())
        iss.push({ level: "error", msg: `${loc}: Spoiler label is empty.` });
      const hasContent = (e.entries && e.entries.length > 0) || e.text?.trim();
      if (!hasContent)
        iss.push({ level: "warn", msg: `${loc}: Spoiler has no child entries.` });
      else if (e.entries?.length)
        e.entries.forEach((child, ci) => validateEntry(child, `${loc} > child ${ci + 1} (${child.type})`));
    }
    if (e.type === "row") {
      const leftEmpty  = !e.left?.length;
      const rightEmpty = !e.right?.length;
      if (leftEmpty && rightEmpty)
        iss.push({ level: "warn", msg: `${loc}: Row has no entries in either column.` });
      else if (leftEmpty)
        iss.push({ level: "warn", msg: `${loc}: Row left column is empty.` });
      else if (rightEmpty)
        iss.push({ level: "warn", msg: `${loc}: Row right column is empty.` });
      (e.left  || []).forEach((child, ci) => validateEntry(child, `${loc} > left ${ci + 1} (${child.type})`));
      (e.right || []).forEach((child, ci) => validateEntry(child, `${loc} > right ${ci + 1} (${child.type})`));
    }
  }

  state.pages.forEach((p, pi) => {
    if (!p.name?.trim())
      iss.push({ level: "error", msg: `Page ${pi + 1}: Name is empty.` });

    p.entries.forEach((e, ei) => {
      const loc = `Page "${p.name || '?'}", entry ${ei + 1} (${e.type})`;
      validateEntry(e, loc);
    });
  });

  return iss;
}