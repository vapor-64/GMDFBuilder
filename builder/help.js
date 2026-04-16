// ── Help overlay ─────────────────────────────────────────────────────────────
// Hold the ? button to see annotated callouts for every major UI area.
// Released or Escape = dismissed.

const HELP_ZONES = [
  {
    selector: '.palette',
    label: 'Entry palette',
    desc: 'All available entry types. Click any item to append it to the canvas, or drag it to a specific position. Each type maps directly to a JSON entry in documentation.json.',
    anchor: 'right',
  },
  {
    selector: '.img-picker-group',
    label: 'Asset uploads',
    desc: 'Upload images (PNG/JPG/GIF) and i18n translation JSON files so the preview reflects your mod accurately. Images are referenced by path in entries; i18n keys resolve {{i18n:key}} tokens live.',
    anchor: 'bottom',
  },
  {
    selector: '.sample-picker-group',
    label: 'Sample loader',
    desc: 'Click to load the selected sample variant, or click ▾ to pick a different one. Samples demonstrate all entry types and are a good starting point for your own documentation.',
    anchor: 'bottom',
  },
];

const SPOT_PAD = 6;
const ARROW    = 10;

let _helpActive = false;

function showHelpOverlay() {
  if (_helpActive) return;
  _helpActive = true;

  const overlay = document.createElement('div');
  overlay.id        = 'help-overlay';
  overlay.className = 'help-overlay';

  // Backdrop is purely visual — pointer-events none so mouseup reaches document
  const backdrop = document.createElement('div');
  backdrop.className = 'help-backdrop';
  overlay.appendChild(backdrop);

  const scale = parseFloat(document.documentElement.style.getPropertyValue('--scale') || '1') || 1;

  HELP_ZONES.forEach(zone => {
    const el = document.querySelector(zone.selector);
    if (!el) return;

    const r      = el.getBoundingClientRect();
    const top    = r.top    / scale;
    const left   = r.left   / scale;
    const width  = r.width  / scale;
    const height = r.height / scale;

    const spot = document.createElement('div');
    spot.className = 'help-spot';
    spot.style.cssText = `top:${top - SPOT_PAD}px;left:${left - SPOT_PAD}px;width:${width + SPOT_PAD * 2}px;height:${height + SPOT_PAD * 2}px;`;
    overlay.appendChild(spot);

    const bubble  = document.createElement('div');
    bubble.className = 'help-bubble help-bubble--' + zone.anchor;

    const title = document.createElement('div');
    title.className   = 'help-bubble-title';
    title.textContent = zone.label;

    const desc = document.createElement('div');
    desc.className   = 'help-bubble-desc';
    desc.textContent = zone.desc;

    bubble.appendChild(title);
    bubble.appendChild(desc);

    const bubbleW = 260;
    const gap     = SPOT_PAD + ARROW + 8;

    switch (zone.anchor) {
      case 'bottom':
        bubble.style.left = Math.max(8, left + width / 2 - bubbleW / 2) + 'px';
        bubble.style.top  = (top + height + gap) + 'px';
        break;
      case 'right':
        bubble.style.left = (left + width + gap) + 'px';
        bubble.style.top  = Math.max(8, top + height / 2 - 50) + 'px';
        break;
      case 'left':
        bubble.style.left = Math.max(8, left - bubbleW - gap) + 'px';
        bubble.style.top  = Math.max(8, top + height / 2 - 50) + 'px';
        break;
      case 'top':
        bubble.style.left = Math.max(8, left + width / 2 - bubbleW / 2) + 'px';
        bubble.style.top  = Math.max(8, top - gap - 80) + 'px';
        break;
    }
    bubble.style.width = bubbleW + 'px';
    overlay.appendChild(bubble);
  });

  const hint = document.createElement('div');
  hint.className   = 'help-release-hint';
  hint.textContent = 'Release ? or press Esc to close';
  overlay.appendChild(hint);

  document.body.appendChild(overlay);

  // Dismiss on mouseup anywhere — catches release even over the overlay
  function onUp()  { dismissHelp(); cleanup(); }
  function onKey(e) { if (e.key === 'Escape') { dismissHelp(); cleanup(); } }
  function cleanup() {
    document.removeEventListener('mouseup',  onUp);
    document.removeEventListener('keydown',  onKey);
  }
  document.addEventListener('mouseup',  onUp);
  document.addEventListener('keydown',  onKey);
}

function dismissHelp() {
  if (!_helpActive) return;
  _helpActive = false;
  const overlay = document.getElementById('help-overlay');
  if (!overlay) return;
  overlay.classList.add('help-overlay--out');
  setTimeout(() => overlay.remove(), 180);
}
