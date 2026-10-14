import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";

const tsFiles = ["**/*.ts"];

export default [
  { ignores: ["node_modules/", "build/", "coverage/", "**/*.js", "**/*.mjs", "**/*.cjs"] },
  { ...js.configs.recommended, files: tsFiles },
  ...tseslint.configs["flat/recommended"].map(config => ({ ...config, files: tsFiles })),
  {
    files: tsFiles,
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      "no-console": "warn",
      "prefer-const": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowInterfaces: "with-single-extends" },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
    },
  },
];
