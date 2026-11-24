import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'audio/fallback-calm.wav'],
      manifest: {
        name: 'Respira — Apoio Emocional Imediato',
        short_name: 'Respira',
        description:
          'Botão de pânico sensorial com áudio acolhedor offline, vibração calmante e guia de respiração.',
        theme_color: '#0f766e',
        background_color: '#f0fdfa',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'pt-BR',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wav,woff2}'],
        // Não intercepta requisições de streaming MP3 / Range (bytes=0-) do Jamendo nem do proxy,
        // evitando falhas de reprodução no iOS Safari e Chrome Android. O cache offline dos MP3s é
        // gerenciado diretamente via Cache API ('anti-panic-audio-v1') + IndexedDB com ObjectURLs.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*jamendo\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /\/bot\/audio-proxy/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
