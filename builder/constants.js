const SCALE = 1.2;

const ENTRY_TYPES = [
  { type:"sectionTitle", label:"Section Title",    icon:"H",   color:"#b14e05", hasAlign:1, hasText:1, hasFontSize:1 },
  { type:"paragraph",    label:"Paragraph",        icon:"¶",   color:"#4a6741", hasAlign:1, hasText:1, hasFontSize:1 },
  { type:"caption",      label:"Caption",          icon:"Cc",  color:"#666",    hasAlign:1, hasText:1, hasFontSize:1 },
  { type:"image",        label:"Image",            icon:"▣",   color:"#2d6b9e", hasAlign:1, hasImage:1 },
  { type:"list",         label:"Bullet List",      icon:"•",   color:"#8b6914", hasAlign:1, hasList:1,  hasFontSize:1 },
  { type:"orderedList",  label:"Numbered List",    icon:"1.",  color:"#8b6914", hasAlign:1, hasList:1,  hasFontSize:1 },
  { type:"keyValue",     label:"Key → Value",      icon:"⇒",   color:"#3c3c78",                         hasFontSize:1 },
  { type:"divider",      label:"Divider",          icon:"—",   color:"#b48c50" },
  { type:"spacer",       label:"Spacer",           icon:"↕",   color:"#999" },
  { type:"spoiler",      label:"Spoiler",          icon:"▸",   color:"#6a3a6a", hasSpoiler:1 },
  { type:"row",          label:"Row (2 columns)",  icon:"⊟",   color:"#5a3a8a", hasRow:1 },
  { type:"gif",          label:"Animated GIF",     icon:"▶",   color:"#1a7a6e", hasAlign:1, hasGif:1 },
  { type:"link",         label:"Link",             icon:"🔗",  color:"#1a5296", hasAlign:1, hasLink:1 },
  { type:"internalLink", label:"Internal Link",     icon:"↩",   color:"#1e7a45", hasAlign:1, hasInternalLink:1 },
  { type:"indentBlock",  label:"Indent Block",      icon:"⇥",   color:"#5a6e3a", hasIndentBlock:1 },
];

const COLUMN_ENTRY_TYPES = ENTRY_TYPES.filter(t => t.type !== 'row');

const DIVIDER_STYLES = ["single", "double", "dotted", "iconCentered"];
const ALIGNS = ["left", "center", "right"];

const DEFAULT_FONT_SIZES = {
  sectionTitle: 20,
  paragraph:    18,
  caption:      16,
  list:         16,
  orderedList:  16,
  keyValue:     16,
};

const uid = () => Math.random().toString(36).slice(2, 10);

// ── Per-entry help content ────────────────────────────────────────────────────
const ENTRY_HELP = {
  sectionTitle: {
    summary: "A bold heading that introduces a new section. Renders in the accent colour at a larger size than body text.",
    params: [
      { name: "Text",      desc: "The heading text. Supports inline item sprites using [(QUAL)ID] syntax and {{i18n:key}} tokens." },
      { name: "Align",     desc: "Horizontal alignment of the heading: left, center, or right." },
      { name: "Font size", desc: "Override the rendered size in pixels. Default is 20px." },
      { name: "Anchor ID", desc: "Auto-generated UUID. Copy it and paste into an Internal Link\u2019s Anchor field to jump directly to this heading." },
    ]
  },
  paragraph: {
    summary: "A block of body text. The most common entry type for descriptive content.",
    params: [
      { name: "Text",      desc: "The paragraph content. Use \\n for manual line breaks. Supports [(QUAL)ID] sprites and {{i18n:key}} tokens." },
      { name: "Align",     desc: "Horizontal alignment: left, center, or right." },
      { name: "Font size", desc: "Override the rendered size in pixels. Default is 18px." },
      { name: "Anchor ID", desc: "Auto-generated UUID. Copy it and paste into an Internal Link\u2019s Anchor field to jump directly to this paragraph." },
    ]
  },
  caption: {
    summary: "Small, muted text used for supplementary notes, image captions, or footer remarks. Centred by default.",
    params: [
      { name: "Text",      desc: "The caption content. Supports {{i18n:key}} tokens." },
      { name: "Align",     desc: "Horizontal alignment. Defaults to center." },
      { name: "Font size", desc: "Override the rendered size in pixels. Default is 16px." },
    ]
  },
  image: {
    summary: "Displays a static image from your mod\u2019s assets folder. Can optionally float beside a bullet list.",
    params: [
      { name: "Texture path", desc: "Path to the image relative to your mod folder, e.g. assets/banner.png." },
      { name: "Scale",        desc: "Pixel scale multiplier. 1 = native size, 2 = double size (default), 0.5 = half size." },
      { name: "Align",        desc: "When no float items are set, controls horizontal placement. When float items are set, left/right determines which side the image floats on." },
      { name: "Float items",  desc: "Optional bullet list that renders beside the image when align is left or right. Leave empty for a standard full-width image." },
    ]
  },
  list: {
    summary: "An unordered bullet list. Each item is a separate line with a bullet character.",
    params: [
      { name: "Items",     desc: "One entry per bullet point. Each item supports [(QUAL)ID] sprites and {{i18n:key}} tokens." },
      { name: "Align",     desc: "Horizontal alignment of the list block." },
      { name: "Font size", desc: "Override the rendered size in pixels. Default is 16px." },
    ]
  },
  orderedList: {
    summary: "A numbered list. Items are automatically numbered 1, 2, 3\u2026 in order.",
    params: [
      { name: "Items",     desc: "One entry per numbered item. Each item supports [(QUAL)ID] sprites and {{i18n:key}} tokens." },
      { name: "Align",     desc: "Horizontal alignment of the list block." },
      { name: "Font size", desc: "Override the rendered size in pixels. Default is 16px." },
    ]
  },
  keyValue: {
    summary: "A key\u2192value row used for config option tables, stat blocks, or any label\u2013value pair. The key renders in blue.",
    params: [
      { name: "Key",       desc: "The label on the left. Supports {{i18n:key}} tokens and [(QUAL)ID] sprites." },
      { name: "Value",     desc: "The value on the right. Supports {{i18n:key}} tokens and [(QUAL)ID] sprites." },
      { name: "Font size", desc: "Override the rendered size in pixels. Default is 16px." },
    ]
  },
  divider: {
    summary: "A horizontal rule that visually separates sections. No body content \u2014 all options are in the header.",
    params: [
      { name: "Style", desc: "single \u2014 a plain thin line. double \u2014 two parallel lines. dotted \u2014 a dotted line. iconCentered \u2014 a line with a small diamond centred in it." },
    ]
  },
  spacer: {
    summary: "An invisible vertical gap for adding breathing room between entries.",
    params: [
      { name: "Height", desc: "Gap height in pixels. Default is 16px." },
    ]
  },
  spoiler: {
    summary: "A collapsible block. The header bar is always visible; the content is hidden until the player clicks it.",
    params: [
      { name: "Label",          desc: "Text shown in the clickable header bar. Keep it short." },
      { name: "Hidden content", desc: "The text revealed after clicking. Supports {{i18n:key}} tokens." },
    ]
  },
  row: {
    summary: "A two-column layout container. Place any entries into the left and right columns. Columns cannot be nested.",
    params: [
      { name: "Left fraction", desc: "The slider controls how much horizontal space the left column takes. 50% = equal columns. Drag right to widen the left column." },
      { name: "Left / Right",  desc: "Add entries to each column using the + buttons. Most entry types are supported inside a row, except another row." },
    ]
  },
  gif: {
    summary: "An animated sprite sheet played as a looping GIF. The sheet is sliced into frames and cycled automatically.",
    params: [
      { name: "Sprite sheet path", desc: "Path to the sprite sheet image relative to your mod folder." },
      { name: "Scale",             desc: "Pixel scale multiplier applied to each frame." },
      { name: "Frame count",       desc: "Total number of animation frames in the sheet." },
      { name: "Frame duration",    desc: "How long each frame is shown, in seconds. 0.1 = 10 fps." },
      { name: "Columns",           desc: "Number of columns in the sprite sheet grid. Set to 0 for a single horizontal strip." },
      { name: "Rows",              desc: "Number of rows in the sprite sheet grid." },
      { name: "Align",             desc: "Horizontal placement of the animation: left, center, or right." },
    ]
  },
  link: {
    summary: "A clickable hyperlink that opens a URL in the player\u2019s browser. Only https:// and http:// URLs are permitted \u2014 other schemes are blocked in-game.",
    params: [
      { name: "Label", desc: "The visible link text. Supports {{i18n:key}} tokens." },
      { name: "URL",   desc: "The full URL to open. Must start with https:// or http://. The safety badge turns green when the scheme is valid." },
      { name: "Align", desc: "Horizontal alignment of the link text." },
    ]
  },
  internalLink: {
    summary: "A clickable link that navigates within the in-game documentation viewer \u2014 no browser, no confirmation dialog. Can jump to a different mod\u2019s documentation, a specific page, or a specific anchor on a page.",
    params: [
      { name: "Label",            desc: "The visible link text. Supports {{i18n:key}} tokens." },
      { name: "Target Mod ID",    desc: "UniqueID of the target mod (e.g. author.ModName). Leave blank to link within this mod\u2019s own documentation." },
      { name: "Target Page ID",   desc: "The id field of the target page. Leave blank to navigate to the mod\u2019s first page." },
      { name: "Anchor",           desc: "The anchor ID from a sectionTitle or paragraph on the target page. Copy it using the \uD83D\uDD17 button on the target entry. Leave blank to scroll to the top of the page." },
      { name: "Align",            desc: "Horizontal alignment of the link text." },
    ]
  },
  indentBlock: {
    summary: "Indents a group of child entries to the right, with an optional vertical rule on the left. Useful for sub-sections, step breakdowns, or nested detail.",
    params: [
      { name: "Indent",           desc: "How many pixels to indent the child entries from the left edge. Default is 32px. Each nested indentBlock adds to the previous." },
      { name: "Show vertical rule", desc: "Draws a subtle vertical line on the left side of the indented block, helping the reader see the nesting level." },
      { name: "Child entries",    desc: "Add any entry types inside the block using the + Add Child Entry button. IndentBlocks can be nested inside each other." },
    ]
  },
};

/**
 * Generates a UUID v4 anchor ID for a new anchorable entry.
 * The anchor is set once at creation time and never auto-updated, so that
 * existing internalLink references aren't silently broken by text edits.
 * Authors can manually replace it with a readable slug if preferred,
 * or use the Regenerate button to derive one from the entry's text.
 */
function slugifyAnchor() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function defaultEntry(type) {
  const b = { _id: uid(), type };
  const m = ENTRY_TYPES.find(t => t.type === type);
  if (m?.hasText)    b.text  = "";
  if (m?.hasAlign)   b.align = type === "caption" ? "center" : "left";
  if (m?.hasImage)   { b.texture = ""; b.scale = 2; b.items = []; }
  if (m?.hasList)    b.items = [""];
  if (m?.hasSpoiler) { b.label = "Spoiler"; b.text = ""; }
  if (type === "keyValue") { b.key = ""; b.value = ""; }
  if (type === "divider")  b.style  = "single";
  if (type === "spacer")   b.height = 16;
  if (type === "row")      { b.left = []; b.right = []; b.leftFraction = 0.5; }
  if (type === "gif")      { b.texture = ""; b.frameCount = 1; b.frameDuration = 0.1; b.scale = 1; b.columns = 0; b.rows = 1; }
  if (type === "link")     { b.text = ""; b.url = ""; }
  if (type === "internalLink") { b.text = ""; b.mod = ""; b.page = ""; b.anchor = ""; }
  if (type === "indentBlock") { b.indent = 32; b.showRule = true; b.entries = []; }

  // Auto-generate a stable UUID anchor for anchorable entry types.
  // Set once at creation and never overwritten by text edits.
  if (type === "sectionTitle" || type === "paragraph") {
    b.anchor = slugifyAnchor();
  }

  return b;
}