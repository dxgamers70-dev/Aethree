import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Integration tests are opt-in; exclude unless RUN_INTEGRATION is set.
    exclude: process.env.RUN_INTEGRATION
      ? ["node_modules/**"]
      : ["node_modules/**", "**/*.integration.test.ts"],
  },
});
