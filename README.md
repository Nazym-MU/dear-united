# Manchester United — hub

A multi-page site. The landing page is a sealed letter that opens on scroll;
from there, three destinations: the stadium tour, the history, and the season.

## Running

```
npm install
npm run dev      # local dev server
npm run build    # production build into dist/
```

## Pages

| File | What it is | Status |
| --- | --- | --- |
| `index.html` | The letter — landing page | built |
| `stadium.html` | Scroll-driven 3D Old Trafford tour | built |
| `history.html` | Eras, managers, legendary players | placeholder |
| `season.html` | Squad, fixtures, results, table | placeholder |

New pages must be registered in `vite.config.js` under `build.rollupOptions.input`,
or they will not be emitted by `npm run build`.

## Editing the text

- **Letter** — `src/data/letter.js`. `paragraphs` is an array; the sheet and the
  scroll length resize themselves to fit however much you write.
- **Stadium tour** — `src/data/story.js`. Chapter titles, copy, cameras, photos.

## Adding photos

Drop images into `public/photos/` using the filenames in
`public/photos/README.md`. They appear in the polaroid frames automatically.

## Structure

- `src/letter.js` — landing page: scroll-driven envelope opening
- `src/data/letter.js` — letter copy and the three destination links
- `src/stadium.js` — Three.js scene: loading, assembly, camera path
- `src/main.js` — stadium scroll orchestration and explore controls
- `src/data/story.js` — stadium chapter content and cameras
- `src/styles/letter.css` — landing page
- `src/styles/global.css` — stadium tour
- `src/styles/placeholder.css` — holding pages
- `scripts/shoot.mjs` — screenshot harness for the stadium
- `scripts/shoot-letter.mjs` — screenshot harness for the letter
- `scripts/fetch-player-photos.mjs` — pulls album player/manager photos from
  Wikipedia into `public/photos/players/` (re-run after adding seasons; skips
  files already on disk, `--force` re-fetches everything)

The model lives in `public/models/old-trafford.glb` (Draco-compressed).
