import js from "@eslint/js";
import globals from "globals";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["node_modules/", "build/", "coverage/"],
  },
  js.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslint,
    },
    rules: {
      "no-console": "warn",
      "prefer-const": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "no-redeclare": "off",
      "@typescript-eslint/no-redeclare": "error",
      "no-case-declarations": "off",
    },
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      "no-console": "off", // Allow console in JS files (like test files)
    },
  },
];
