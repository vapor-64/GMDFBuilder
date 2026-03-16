const SAMPLE_JSON = `{
  "$schema": "https://raw.githubusercontent.com/vapor64/GMDF/master/documentation.schema.json",
  "format": 1,
  "modName": "Sample Documentation",
  "pages": [
    {
      "name": "Overview",
      "headerImage": {
        "texture": "header.png"
      },
      "entries": [
        {
          "type": "divider",
          "style": "iconCentered"
        },
        {
          "type": "row",
          "left": [
            {
              "type": "sectionTitle",
              "text": "Overview"
            },
            {
              "type": "paragraph",
              "text": "Lorem ipsum dolor [276] sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco [(BC)64] laboris nisi ut aliquip ex ea commodo consequat."
            },
            {
              "type": "list",
              "items": [
                "Lorem ipsum dolor sit amet",
                "consectetur adipiscing elit"
              ]
            }
          ],
          "right": [
            {
              "type": "gif",
              "align": "right",
              "texture": "pennygif.png",
              "scale": 0.6,
              "frameCount": 31,
              "frameDuration": 0.02,
              "columns": 6,
              "rows": 6
            }
          ],
          "leftFraction": 0.7
        },
        {
          "type": "divider",
          "style": "dotted"
        },
        {
          "type": "row",
          "left": [
            {
              "type": "image",
              "texture": "sample.png",
              "scale": 0.3
            }
          ],
          "right": [
            {
              "type": "orderedList",
              "items": [
                "Lorem ipsum dolor sit amet consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua",
                "Lorem ipsum dolor sit amet consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua",
                "labore et dolore magna aliqua[(O)215] Lorem ipsum dolor sit amet consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua"
              ]
            }
          ],
          "leftFraction": 0.25
        },
        {
          "type": "divider"
        },
        {
          "type": "row",
          "left": [
            {
              "type": "spoiler",
              "text": "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
            }
          ],
          "right": [
            {
              "type": "keyValue",
              "key": "Lorem ",
              "value": "ipsum "
            },
            {
              "type": "keyValue",
              "key": "[(BC)7]",
              "value": "[(O)2]"
            }
          ]
        }
      ]
    }
  ]
}`;

const SAMPLE_IMAGE_PATHS = [
  "assets/header.png",
  "assets/pennygif.png",
  "assets/sample.png",
];

async function loadSampleDocumentation() {
  if (!confirm("Load the sample documentation? This will replace your current work.")) return;

  
  
  
  let imagesFailed = false;
  for (const path of SAMPLE_IMAGE_PATHS) {
    try {
      const fname = path.split('/').pop();
      const existing = assetStore.get(fname);
      if (existing) URL.revokeObjectURL(existing.blobUrl);
      const resp = await fetch(path);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      assetStore.set(fname, { blobUrl, originalName: fname });
    } catch (err) {
      console.warn('loadSampleDocumentation: skipping ' + path + ' (' + err.message + ')');
      imagesFailed = true;
    }
  }

  try {
    const err = applyImport(SAMPLE_JSON);
    if (err) {
      console.error('loadSampleDocumentation: applyImport failed:', err);
      alert('Failed to load sample: ' + err);
      return;
    }
  } catch (e) {
    console.error('loadSampleDocumentation: render crashed:', e);
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