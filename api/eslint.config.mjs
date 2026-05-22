import { defineConfig } from "eslint/config";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([{
    extends: compat.extends("eslint:recommended"),

    languageOptions: {
        globals: {
            ...globals.node,
        },

        ecmaVersion: "latest",
        sourceType: "module",
    },

    rules: {
        "no-unused-vars": ["warn", {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
        }],

        "no-console": "warn",
        "no-process-exit": "off",
        "prefer-const": "error",
        "no-var": "error",
        eqeqeq: ["error", "always"],
        curly: ["error", "all"],
        "no-throw-literal": "error",
        "prefer-template": "warn",
        "object-shorthand": "warn",
        "arrow-body-style": ["warn", "as-needed"],
    },
}]);