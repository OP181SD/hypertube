import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from '@tailwindcss/vite'
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    // Same-origin proxy so <video>/tracks send cookies without cross-origin CORS.
    proxy: {
      "/stream": {
        target: "http://localhost:3000",
        changeOrigin: true,
        // Long-lived progressive streams (torrent may buffer before first byte).
        timeout: 0,
        proxyTimeout: 0,
      },
      "/subtitles": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
});
