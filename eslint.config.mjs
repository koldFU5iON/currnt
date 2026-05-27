import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Reference implementations / pre-written modules used as design
    // material, not shipping code — see the "Reference docs" section of
    // AGENTS.md. We don't want lint noise from them.
    "docs/**",
  ]),
]);

export default eslintConfig;
