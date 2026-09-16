import { defineConfig, globalIgnores } from "eslint/config";
import eslint from "@eslint/js";
import next from "@next/eslint-plugin-next";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const eslintConfig = defineConfig([
  globalIgnores([
    ".next/**",
    "dist/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,
  react.configs.flat["jsx-runtime"],
  reactHooks.configs.flat["recommended-latest"],
  jsxA11y.flatConfigs.recommended,
  next.configs["core-web-vitals"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker,
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    files: ["app/layout.tsx"],
    rules: {
      // The App Router root layout owns the shared font links; the rule targets
      // the legacy Pages Router's _document convention.
      "@next/next/no-page-custom-font": "off",
    },
  },
  {
    files: ["public/completion.js"],
    rules: {
      // This legacy browser bundle intentionally retains dormant render helpers
      // used by multiple static completion views. All other safety rules remain on.
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]);

export default eslintConfig;
