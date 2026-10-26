# Reguli pentru active media și fișiere PNG

Toate fișierele de imagine (PNG, JPG, SVG, WebP, ICO), inclusiv iconițele aplicației, asset-urile generate sau adăugate în proiect, trebuie plasate obligatoriu și exclusiv în folderul `public/` (ex: `public/icon.png`, `public/favicon.png`), niciodată în rădăcina proiectului.

Toate referințele din cod (HTML, CSS, JS, manifest.json, sw.js) trebuie să utilizeze calea relativă către `public/` (ex: `public/filename.png`).
