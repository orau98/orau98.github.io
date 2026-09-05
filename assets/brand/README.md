# Site logo: C1

Approved design: C1, the rounded ivory leaf with three enlarged feeding notches on a muted green/teal tile (selected 2026-09-05).

`logo-c1-source.png` is the unchanged approved image. `npm run build:site-icons` deterministically removes only its connected outer presentation background, crops to the tile, preserves its proportions, and exports the public PNG, ICO and self-contained SVG assets. It does not redraw the leaf. The SVG embeds PNG artwork; it is not a vector master.

The React header and Japanese/English static headers share `SITE_LOGO_SRC` in `src/utils/siteBrand.js`. Keep the icon version there, `index.html` and `public/site.webmanifest` in sync. `tests/site-brand.test.mjs` checks these references and export dimensions.

The regular PNGs have transparent outer corners. The Apple icon is flattened on warm ivory. The manifest uses `purpose: any`; these exports are not claimed to be maskable-safe. No unrelated site colors or content are changed.
