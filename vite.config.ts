/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// Content-Security-Policy only for production builds (dev needs the HMR websocket).
// Every external origin the app talks to must be listed here and in docs/HOSTING.md.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://tile.openstreetmap.org",
  "font-src 'self'",
  "connect-src 'self' https://api.github.com https://routing.openstreetmap.de https://api.met.no",
  "manifest-src 'self'",
  "worker-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function cspPlugin(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<head>', `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`);
    },
  };
}

export default defineConfig({
  // Relative base so the same build works at https://<user>.github.io/<repo>/ and locally.
  base: './',
  plugins: [
    preact(),
    cspPlugin(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Tbilisi Tourstudio',
        short_name: 'Tourstudio',
        description: 'Wandeltours ontwerpen en gidsen in Tbilisi',
        lang: 'nl',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#EFE8DA',
        theme_color: '#1F1D1B',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only. Map tiles are deliberately NOT cached: the OSM tile policy forbids offline use.
        globPatterns: ['**/*.{js,css,html,svg,png}', '**/*-latin-*.woff2'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Control the page on the very first visit so offline works without a second load.
        // Updates still wait for the user's "Vernieuwen" (no skipWaiting).
        clientsClaim: true,
      },
    }),
  ],
  test: {
    environment: 'node',
  },
});
