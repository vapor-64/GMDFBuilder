const TOKEN_PATTERN = /\[\(([A-Za-z]+)\)([A-Za-z0-9_]+)\]|\[([0-9]+)\]/g;

function renderInlineContent(text, spriteSize) {
  spriteSize = spriteSize || 16;
  const frag = document.createDocumentFragment();
  if (!text) return frag;

  
  text = resolveI18n(text);

  
  const re = new RegExp(TOKEN_PATTERN.source, 'g');
  let lastIndex = 0;
  let m;

  while ((m = re.exec(text)) !== null) {
    
    if (m.index > lastIndex) {
      frag.appendChild(document.createTextNode(text.slice(lastIndex, m.index)));
    }

    let qualifier, itemId;
    if (m[3] !== undefined) {
      
      qualifier = 'O';
      itemId    = m[3];
    } else {
      qualifier = m[1]; 
      itemId    = m[2];
    }

    frag.appendChild(resolveSprite(qualifier, itemId, spriteSize));
    lastIndex = m.index + m[0].length;
  }

  
  if (lastIndex < text.length) {
    frag.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  return frag;
}

function resolveSprite(qualifier, itemId, spriteSize) {
  const sprites = window.GMDF_SPRITES || {};
  const dataUri = sprites[`${qualifier}:${itemId}`];

  if (dataUri) {
    const img = document.createElement('img');
    img.src       = dataUri;
    img.className = 'pv-inline-sprite';
    img.title     = `[(${qualifier})${itemId}]`;
    img.style.width  = spriteSize + 'px';
    img.style.height = spriteSize + 'px';
    img.addEventListener('load', () => {
      if (img.naturalHeight > 0) {
        const scale = spriteSize / img.naturalHeight;
        img.style.width  = Math.round(img.naturalWidth * scale) + 'px';
        img.style.height = spriteSize + 'px';
      }
    });
    return img;
  }

  
  const badge = document.createElement('span');
  badge.className   = 'pv-inline-badge';
  badge.textContent = `(${qualifier})${itemId}`;
  badge.title       = `Item token: [(${qualifier})${itemId}] — not found in sprite sheet`;
  return badge;
}