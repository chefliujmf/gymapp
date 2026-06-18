import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'GymApp — Personal Training',
        short_name: 'GymApp',
        description: 'Your personal self-hosted workout, program and recipe library.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // Let server routes (API/Swagger, auth, intervals proxy) bypass the SPA
        // shell fallback — else navigating to /api/docs loads the app and errors.
        navigateFallbackDenylist: [/^\/api/, /^\/auth/, /^\/icu/],
        // The catalog data (recipes + 796 endurance workouts) makes the bundle
        // ~2.5MB; precache it so the app works fully offline.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        // Media streams from origin at runtime — cache thumbnails only.
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    // Proxy intervals.icu so the browser can read the plan without CORS issues.
    // In production a serverless function does the same (keeps the key server-side).
    proxy: {
      '/icu': {
        target: 'https://intervals.icu',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/icu/, ''),
      },
    },
  },
})
