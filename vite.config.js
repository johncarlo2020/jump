import { defineConfig } from 'vite'

export default defineConfig({
  // Use relative base so asset URLs work under Tauri's asset:// protocol
  base: './',
  root: 'src',
  publicDir: 'assets',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      // paths relative to root ('src/')
      input: {
        main: 'index.html',
        settings: 'settings.html',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
