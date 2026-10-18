import { resolve } from "node:path";

import preact from "@preact/preset-vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [preact()],
  publicDir: "public",
  build: {
    emptyOutDir: true,
    modulePreload: {
      polyfill: false,
    },
    sourcemap: false,
    target: "es2022",
    rollupOptions: {
      input: {
        popup: resolve("popup.html"),
        "side-panel": resolve("side-panel.html"),
        "service-worker": resolve("src/background/service-worker.ts"),
      },
      output: {
        entryFileNames(chunkInfo) {
          if (
            chunkInfo.name === "service-worker"
          ) {
            return "assets/[name].js";
          }

          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/chunks/surface-[hash].js",
        assetFileNames: "assets/surface-[hash][extname]",
      },
    },
  },
});
