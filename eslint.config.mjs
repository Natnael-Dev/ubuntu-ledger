import tseslint from "typescript-eslint";
import nextPlugin from "@next/eslint-plugin-next";

export default tseslint.config(
  {
    ignores: [
      ".next/**",
      "out/**",
      "node_modules/**",
      "*.tsbuildinfo",
      "next-env.d.ts",
      "docs/**",
      "coverage/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },
  {
    files: ["src/domain/**/*.{ts,tsx,js,jsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "../infra/**",
                "../../infra/**",
                "../../../infra/**",
                "@/infra/**",
                "src/infra/**",
                "next/**",
                "next",
                "@supabase/**",
                "@supabase/supabase-js",
                "fs",
                "node:fs",
                "node:fs/promises",
                "http",
                "node:http",
                "https",
                "node:https",
                "net",
                "node:net",
              ],
              message:
                "Domain layer must not import from infra, next, supabase, or I/O libraries (02-architecture.md §4).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx,js,jsx}"],
    ignores: ["src/infra/clock/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.object.name='Date'][callee.property.name='now']",
          message:
            "Date.now() is forbidden outside infra/clock. Use infra/clock instead (02-architecture.md §4).",
        },
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message:
            "new Date() without arguments is forbidden outside infra/clock. Use infra/clock instead (02-architecture.md §4).",
        },
      ],
    },
  }
);
