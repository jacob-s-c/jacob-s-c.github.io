# personal-website

Static site, no build step. Open `index.html` in a browser to preview.

- **About text**: edit the `<article data-creature="…">` blocks at the bottom of `index.html`. Each one is revealed by that creature in the tide pool.
- **Research**: edit the `.specimen` cards in `index.html`.
- **Hotspots** (outline, name, species of each creature in the photo): `SPOTS` in `main.js`, in original-photo pixel coordinates (2160 × 2880). Add `?debug` to the URL to see the outlines.
- **Photos**: `images/` (web-sized copies; full-size originals are git-ignored).
- Preview a specific note: `index.html?peek=coral` (coral, urchin, seaweed).
- **Styles**: `styles.css`.

Hosted on Vercel; every push to `main` redeploys.
