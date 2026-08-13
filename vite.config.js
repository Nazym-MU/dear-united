import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  assetsInclude: ['**/*.glb'],
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
