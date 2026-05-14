import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  root: "client",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "robots.txt"],
      manifest: {
        name: "Calculadora de pão sem glúten",
        short_name: "Pão",
        description: "Calcula massa, custo e lista de compras para o pão sem glúten.",
        theme_color: "#b04826",
        background_color: "#f4ecdc",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
        ]
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//, /^\/healthz$/]
      }
    })
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true
  },
  server: {
    port: 5173,
    host: true,                           // 0.0.0.0 — acessível na LAN
    allowedHosts: [".local", ".lan"],     // raspberrypi.local, pao.lan, etc.
    proxy: {
      "/api": "http://localhost:3000",
      "/healthz": "http://localhost:3000"
    }
  }
});
