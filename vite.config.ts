/// <reference types="vitest" />
import { defineConfig, PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import { sri } from "vite-plugin-sri3";
import { VitePWA } from "vite-plugin-pwa";

const host = process.env.TAURI_DEV_HOST;

const isTauri = process.env.TAURI_ENV_PLATFORM_VERSION !== undefined;

// https://vite.dev/config/
const config = defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION),
    __COMMIT_SHA__: JSON.stringify(process.env.COMMIT_SHA),
  },
  test: {
    printConsoleTrace: true,
    // mock kaspa wasm and cipher globally
    setupFiles: ["src/vitest.setup.ts"],
  },
  plugins: [react({})],
  server: {
    port: 3000,
    host: host || "0.0.0.0",
    strictPort: true,
    watch: {
      ignored: [
        "**/*.test*",
        "**/dist/**",
        "**/.cache/**",
        "**/coverage/**",
        "**/*.log",
        "**/vendors/**",
        "**/src-tauri/**",
      ],
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  esbuild: {
    keepNames: true,
  },
  optimizeDeps: {
    entries: ["src/main.tsx"],
    include: [
      "react",
      "react-dom",
      "react-router",
      "zustand",
      "@tauri-apps/api",
    ],
    exclude: ["../wasm/kaspa.js", "../cipher-wasm/cipher.js"],
  },
  css: { devSourcemap: false },
});

const webPlugins: PluginOption[] = [
  sri(),
  VitePWA({
    registerType: "autoUpdate",
    manifest: {
      name: "Kasia",
      short_name: "Kasia",
      description: "Kasia: Encrypted Messaging Platform",
      theme_color: "#242424",
      background_color: "#242424",
      display: "standalone",
      start_url: "/",
      icons: [
        {
          src: "/kasia-logo-192.png",
          sizes: "192x192",
          type: "image/png",
        },
        {
          src: "/kasia-logo-512.png",
          sizes: "512x512",
          type: "image/png",
        },
      ],
    },
    workbox: {
      // 14 mb
      maximumFileSizeToCacheInBytes: 14000000,
    },
    devOptions: { enabled: false },
  }),
];

if (!isTauri) {
  config.plugins?.push(webPlugins);
  console.log("pushed web plugins");
} else {
  console.log("ignored web plugins");
}

export default config;
