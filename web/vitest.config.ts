import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["@testing-library/jest-dom/vitest"],
    // Playwright specs live in e2e/ and use the @playwright/test runner, not vitest.
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    // PGlite spins up an in-memory WASM Postgres per test. Running many test files
    // concurrently caused WASM resource contention + spurious timeouts, so run files
    // sequentially (tests within a file still run normally). Headroom on timeouts too.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
