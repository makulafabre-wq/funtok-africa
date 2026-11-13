// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [VitePWA({
    strategies: "generateSW",
    outDir: "dist/client",
    filename: "sw.js",
    injectRegister: null,
    registerType: "autoUpdate",
    devOptions: { enabled: false },
    manifest: false,
    workbox: {
      globPatterns: ["**/*.{js,css,ico,png,webmanifest}"],
      navigateFallback: null,
      skipWaiting: true,
      clientsClaim: true,
      cleanupOutdatedCaches: true,
      runtimeCaching: [
        {
          urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname === "/" && !url.pathname.startsWith("/~oauth"),
          handler: "NetworkFirst",
          options: { cacheName: "funtok-public-navigation-v1", networkTimeoutSeconds: 3, matchOptions: { ignoreSearch: true }, expiration: { maxEntries: 1 }, cacheableResponse: { statuses: [200] } },
        },
        {
          urlPattern: ({ url }) => url.origin === self.location.origin && /\/assets\/.*-[\w-]{8,}\.(js|css)$/.test(url.pathname),
          handler: "CacheFirst",
          options: { cacheName: "funtok-hashed-assets-v1", expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 3600 }, cacheableResponse: { statuses: [200] } },
        },
      ],
    },
  })],
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
