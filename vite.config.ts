import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

if (process.platform !== "win32" && process.env.TMPDIR === undefined) {
  process.env.TMPDIR = "/tmp";
}

export default defineConfig({
  base: "/pokemon-sleep-island-simulator/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["island-mark.svg"],
      manifest: {
        name: "おひるね島 育成シミュレーター",
        short_name: "おひるね島計算",
        description:
          "おひるね島のEXP・レベル・長期育成計画を端末内で計算・管理する非公式ツール",
        theme_color: "#147d78",
        background_color: "#f4fbf9",
        display: "standalone",
        scope: "/pokemon-sleep-island-simulator/",
        start_url: "/pokemon-sleep-island-simulator/",
        lang: "ja",
        icons: [
          {
            src: "island-mark.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        navigateFallback: "/pokemon-sleep-island-simulator/index.html",
        globPatterns: ["**/*.{js,css,html,svg,json}"],
      },
    }),
  ],
});
