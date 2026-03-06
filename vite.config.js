import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          epubjs: ['epubjs']
        }
      }
    }
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'text.v',
        short_name: 'text.v',
        description: 'Text & EPUB Reader',
        theme_color: '#007aff',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}']
      }
    })
  ]
})
