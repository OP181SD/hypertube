import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    root: "./",
    include: ["src/**/*.e2e-spec.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    sequence: { concurrent: false },
    setupFiles: ["./test/setup.e2e.ts"],
    // E2E tests must not depend on a developer's real API keys or hit the
    // live OpenSubtitles service — force the "no key" path deterministically.
    env: { OPENSUBTITLES_API_KEY: "" },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@test": resolve(__dirname, "test"),
    },
  },
  plugins: [swc.vite()],
});
