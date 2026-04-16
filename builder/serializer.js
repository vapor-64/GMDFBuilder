function serializeEntry(e) {
  const r = { type: e.type };
  if (e.text  !== undefined) r.text  = e.text;
  if (e.label !== undefined) r.label = e.label;
  
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
  }
  if (e.type === "gif") {
    r.frameCount    = e.frameCount    ?? 1;
    r.frameDuration = e.frameDuration ?? 0.1;
    if (e.columns && e.columns > 0) r.columns = e.columns;
    if (e.rows && e.rows > 1)       r.rows    = e.rows;
  }
  if (e.type === "link" && e.url !== undefined) r.url = e.url;
  return r;
}

function generateJson() {
  return JSON.stringify({
    $schema: "https://raw.githubusercontent.com/vapor64/GMDF/master/documentation.schema.json",
    format:  1,
    modName: state.modName || "My Mod",
    pages: state.pages.map(p => {
      const o = { name: p.name || "Untitled" };
      if (p.headerImage?.trim()) o.headerImage = { texture: p.headerImage };
      o.entries = p.entries.map(e => serializeEntry(e));
      return o;
    })
  }, null, 2);
}

function validate() {
  const iss = [];
  if (!state.modName?.trim())
    iss.push({ level: "error", msg: "Mod name is required." });

  state.pages.forEach((p, pi) => {
    if (!p.name?.trim())
      iss.push({ level: "error", msg: `Page ${pi + 1}: Name is empty.` });

    p.entries.forEach((e, ei) => {
      const loc = `Page "${p.name || '?'}", entry ${ei + 1} (${e.type})`;
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
          iss.push({ level: "warn", msg: `${loc}: URL scheme is not https:// or http:// — link will be blocked in-game.` });
      }
      if (e.type === "indentBlock") {
        if (!e.entries?.length)
          iss.push({ level: "warn", msg: `${loc}: Indent block has no child entries.` });
      }
    });
  });

  return iss;
}