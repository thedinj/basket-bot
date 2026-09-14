import { dirname } from "path";
import { fileURLToPath } from "url";
import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ["**/*.{ts,tsx}"],
        plugins: {
            "react-hooks": reactHooks,
        },
        languageOptions: {
            parserOptions: {
                tsconfigRootDir: __dirname,
            },
        },
        rules: {
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    args: "all",
                    argsIgnorePattern: "^_",
                    caughtErrors: "all",
                    caughtErrorsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    ignoreRestSiblings: true,
                },
            ],
        },
    },
    {
        // Build tooling, run by node rather than shipped to the browser. The rest of this
        // package has no globals declared at all, which is fine for .ts (typescript-eslint
        // turns no-undef off and lets tsc do it) but leaves plain .mjs with nothing defined.
        // Listed by hand rather than pulling in the `globals` package for one file - if more
        // node scripts arrive, swap this for `globals.node`.
        files: ["scripts/**/*.{js,mjs}"],
        languageOptions: {
            globals: {
                Buffer: "readonly",
                console: "readonly",
                process: "readonly",
            },
        },
    },
    {
        ignores: ["dist/**", "node_modules/**", "android/**", "ios/**"],
    }
);
