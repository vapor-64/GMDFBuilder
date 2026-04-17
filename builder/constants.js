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
  if (type === "indentBlock") { b.indent = 32; b.showRule = true; b.entries = []; }
  
  return b;
}