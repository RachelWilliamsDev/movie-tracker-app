import { createRequire } from "node:module";

/**
 * ESLint 9 flat config using Next.js 16’s native flat preset (no FlatCompat).
 *
 * FlatCompat translating `extends("next/core-web-vitals")` can hit a circular-structure
 * crash when @eslint/eslintrc validates the merged config. Prefer the flat export from
 * eslint-config-next: https://nextjs.org/docs/app/api-reference/config/eslint
 */
const require = createRequire(import.meta.url);

/** @type {import("eslint").Linter.Config[]} */
const eslintConfig = [...require("eslint-config-next/core-web-vitals")];

export default eslintConfig;
