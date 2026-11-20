# personal-website

Static site, no build step. Open `index.html` in a browser to preview.

- **About text**: edit the `<article data-creature="…">` blocks at the bottom of `index.html`. Each one is revealed by that creature in the tide pool.
- **Research**: edit the `.specimen` cards in `index.html`.
- **Hotspots** (outline, name, species of each creature in the photo): `SPOTS` in `main.js`, in original-photo pixel coordinates (see PHOTO.w × PHOTO.h). Add `?debug` to the URL to see the outlines.
- **Photos**: `images/` (web-sized copies; full-size originals are git-ignored).
- Preview a specific note: `index.html?peek=left` (left, middle or right).
- **Styles**: `styles.css`.

Hosted on Vercel; every push to `main` redeploys.
- Water effect: realistic ripples rendered with WebGL (`startWater` in `main.js`). Add `?fx=glisten` to the URL for the earlier light-sweep effect. WebGL can't read the photo from a `file://` page, so preview through a local server (`python3 -m http.server`) to see the ripples; without one the photo just shows still.
