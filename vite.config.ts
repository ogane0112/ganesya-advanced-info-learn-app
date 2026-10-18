import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      // manifest も Cloudflare Access の保護下にあるため Cookie 付きで取得させる
      useCredentials: true,
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "応用情報 午後 採点",
        short_name: "AP午後",
        description: "応用情報技術者試験 午後の過去問演習と Claude 採点",
        lang: "ja",
        start_url: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#f6f7f9",
        theme_color: "#1f4e8c",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallback: "/index.html",
        // API は認証が絡むので Service Worker では一切扱わない
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    proxy: { "/api": "http://localhost:8788" },
  },
});
