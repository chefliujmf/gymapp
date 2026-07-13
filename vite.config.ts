import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // registered explicitly in main.tsx (update-on-focus, so an open PWA never serves a stale bundle)
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Platyplus',
        short_name: 'Platyplus',
        description: 'Your whole-fitness platypus — gym, ride, run, mind & plate, all in one.',
        theme_color: '#0d0d0f',
        background_color: '#0d0d0f',
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
        // #506c — DON'T precache index.html. The SW was serving a stale precached shell (pointing at old asset
        // hashes), so every deploy needed a manual hard-refresh (JM + Xenia stuck on old bundles all session). The
        // hashed JS/CSS ARE precached (immutable); the HTML shell is served NetworkFirst below → a normal reload
        // after a deploy picks up the new bundle. `navigateFallback` points at it so offline still works once cached.
        globPatterns: ['**/*.{js,css,svg,png,woff2}'],
        navigateFallback: null,
        // #457 — pull our Web Push handlers (push + notificationclick) into the generated SW.
        importScripts: ['push-sw.js'],
        // A new deploy must take over IMMEDIATELY — the old SW kept serving a stale
        // bundle until every tab closed, which broke login after a deploy. Activate
        // the new SW at once, claim open clients, and purge the previous precache.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Let server routes (API/Swagger, auth, intervals proxy) bypass the SPA
        // shell fallback — else navigating to /api/docs loads the app and errors.
        navigateFallbackDenylist: [/^\/api/, /^\/auth/, /^\/icu/],
        // The catalog data (exercises + recipes + 796 endurance workouts) is bundled
        // into the JS (~6.3MB now); precache it so the app works fully offline.
        // Keep headroom so a small catalog growth can't silently fail the build/deploy.
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
        // Media streams from origin at runtime — cache thumbnails only.
        runtimeCaching: [
          {
            // #506c — the HTML shell NetworkFirst: always fetch fresh when online (so a deploy is picked up on a
            // normal reload), fall back to the cached copy offline. The hashed JS/CSS stay precached (immutable).
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-shell',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: { maxEntries: 4000, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
      // Dev SW OFF — it cached stale JS and made code fixes look like they didn't
      // apply (e.g. auth/chat 401 from an old bundle). PWA/SW still ships in builds.
      devOptions: { enabled: false },
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
      // Media (images/video/audio): real files from PROD, read-only.
      '/media': { target: 'https://platyplus.duckdns.org', changeOrigin: true, secure: true },
      // API + auth: the LOCAL dev backend (npm run dev:api) — isolated dev data,
      // RP_ID=localhost so passkeys work, never touches prod. Start both with
      // `npm run dev:full`.
      '/auth': { target: 'http://localhost:8088', changeOrigin: true },
      '/api': { target: 'http://localhost:8088', changeOrigin: true },
    },
  },
})
