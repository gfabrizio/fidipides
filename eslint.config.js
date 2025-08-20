import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["out", ".vscode-test", "dist"],
  },
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  ...tseslint.configs.recommended,
];
