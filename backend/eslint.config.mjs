// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  {
    ignores: ["dist", "coverage", "node_modules", "eslint.config.mjs"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    rules: {
      // torrent-stream's engine has no typings for its internals, so a few
      // deliberate `any` casts are unavoidable in the streaming layer.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
