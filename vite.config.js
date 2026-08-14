import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// Rewrites absolute public-asset url()s in bundled CSS (url('/textures/…'))
// to be relative to the emitted assets/ dir, so the site works when hosted
// under a subpath (GitHub Pages). Dev keeps the absolute form, which is
// correct at the dev server root.
const rebasePublicCssUrls = {
  name: 'rebase-public-css-urls',
  apply: 'build',
  generateBundle(_, bundle) {
    for (const file of Object.values(bundle)) {
      if (file.type === 'asset' && file.fileName.endsWith('.css')) {
        file.source = file.source
          .toString()
          .replaceAll("url('/", "url('../")
          .replaceAll('url("/', 'url("../')
          .replaceAll('url(/', 'url(../')
      }
    }
  },
}

export default defineConfig({
  base: './',
  assetsInclude: ['**/*.glb'],
  plugins: [rebasePublicCssUrls],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        stadium: resolve(__dirname, 'stadium.html'),
        season: resolve(__dirname, 'season.html'),
        album: resolve(__dirname, 'album.html'),
      },
    },
  },
})
