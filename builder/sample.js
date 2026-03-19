// ─── Sample variant definitions ────────────────────────────────────────────────
// Each variant has:
//   label        – shown in the dropdown
//   imagePaths   – asset paths to pre-load (empty = no images needed)
//   i18nData     – object of key→value pairs to inject as a synthetic i18n file,
//                  or null if the variant uses no i18n keys
//   jsonFile     – path to the sample JSON file to fetch and load

const SAMPLE_VARIANTS = {
  "no-images-no-i18n": {
    label:     "No images, no i18n",
    imagePaths: [],
    i18nData:  null,
    jsonFile:  "sample-no-images-no-i18n.json",
  },
  "images": {
    label:     "Images",
    imagePaths: [
      "assets/header.png",
      "assets/pennygif.png",
      "assets/sample.png",
    ],
    i18nData:  null,
    jsonFile:  "sample-images.json",
  },
  "i18n": {
    label:     "i18n",
    imagePaths: [],
    i18nData: {
      "modName":        "Sample Documentation",
      "page.overview":  "Overview",
      "section.overview": "Overview",
      "overview.intro": "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
      "list.item1":     "Lorem ipsum dolor sit amet",
      "list.item2":     "Consectetur adipiscing elit",
      "list.item3":     "Sed do eiusmod tempor incididunt",
      "section.details": "Details",
      "details.step1":  "Lorem ipsum dolor sit amet consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua",
      "details.step2":  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat",
      "details.step3":  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur",
      "spoiler.label":  "Read more…",
      "spoiler.text":   "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
      "kv.key1":        "Lorem",
      "kv.val1":        "ipsum dolor",
      "kv.key2":        "Sit amet",
      "kv.val2":        "consectetur",
      "caption.footer": "This sample uses i18n keys — switch languages with the 🌐 i18n selector in the header.",
    },
    jsonFile:  "sample-i18n.json",
  },
  "images-i18n": {
    label:     "Images + i18n",
    imagePaths: [
      "assets/header.png",
      "assets/pennygif.png",
      "assets/sample.png",
    ],
    i18nData: {
      "modName":        "Sample Documentation",
      "page.overview":  "Overview",
      "section.overview": "Overview",
      "overview.intro": "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
      "list.item1":     "Lorem ipsum dolor sit amet",
      "list.item2":     "Consectetur adipiscing elit",
      "list.item3":     "Sed do eiusmod tempor incididunt",
      "section.details": "Details",
      "details.step1":  "Lorem ipsum dolor sit amet consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua",
      "details.step2":  "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat",
      "details.step3":  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur",
      "spoiler.label":  "Read more…",
      "spoiler.text":   "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
      "kv.key1":        "Lorem",
      "kv.val1":        "ipsum dolor",
      "kv.key2":        "Sit amet",
      "kv.val2":        "consectetur",
      "caption.footer": "This sample uses both images and i18n keys.",
    },
    jsonFile:  "sample-images-i18n.json",
  },
};

// ─── Loader ────────────────────────────────────────────────────────────────────

async function loadSampleVariant(variantKey) {
  const variant = SAMPLE_VARIANTS[variantKey];
  if (!variant) return;

  if (!confirm(`Load sample "${variant.label}"? This will replace your current work.`)) return;

  // 1. Pre-load images — store under "assets/<fname>" to match how the
  //    JSON references them and how manual uploads are keyed.
  let imagesFailed = false;
  for (const path of variant.imagePaths) {
    try {
      const fname = path.split('/').pop();
      const key   = 'assets/' + fname;
      const existing = assetStore.get(key);
      if (existing) URL.revokeObjectURL(existing.blobUrl);
      const resp = await fetch(path);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      assetStore.set(key, { blobUrl, originalName: fname });
    } catch (err) {
      console.warn('loadSampleVariant: skipping ' + path + ' (' + err.message + ')');
      imagesFailed = true;
    }
  }

  // 2. Inject i18n data
  if (variant.i18nData) {
    // Register the English placeholder as "default.json"
    const defaultFilename = 'default.json';
    i18nStore.set(defaultFilename, {
      label: 'Default',
      data:  variant.i18nData,
    });
    state.activeI18nKey = defaultFilename;

    // Also fetch and register the Spanish sample file
    try {
      const esResp = await fetch('assets/es.json');
      if (esResp.ok) {
        const esData = await esResp.json();
        i18nStore.set('es.json', { label: 'Español', data: esData });
      }
    } catch (e) {
      console.warn('loadSampleVariant: could not load es.json:', e.message);
    }
  }
  // If this variant has no i18n, leave the existing i18n store untouched
  // (user may have their own files loaded; no reason to clear them)

  // 3. Fetch and apply the JSON file
  try {
    const resp = await fetch(variant.jsonFile);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const jsonText = await resp.text();
    const err = applyImport(jsonText);
    if (err) {
      console.error('loadSampleVariant: applyImport failed:', err);
      alert('Failed to load sample: ' + err);
      return;
    }
  } catch (e) {
    console.error('loadSampleVariant: fetch/render crashed:', e);
    alert('Sample load crashed: ' + e.message + '\nCheck the browser console for details.');
    return;
  }

  if (imagesFailed) {
    console.info(
      'Sample loaded without images. ' +
      'To see images, serve the project over HTTP instead of opening index.html directly.\n' +
      'Quick option: run  npx serve .  in the project folder, then open http://localhost:3000'
    );
  }
}
