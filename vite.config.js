import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  // Use relative base so asset URLs work under Tauri's asset:// protocol
  base: './',
  root: 'src',
  publicDir: 'assets',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        settings: resolve(__dirname, 'src/settings.html'),
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
