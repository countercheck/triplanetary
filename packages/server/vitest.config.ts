import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    pool: "forks",
    poolOptions: { forks: { isolate: true } },
    env: {
      DATABASE_URL:
        "postgresql://triplanetary:triplanetary@localhost:5433/triplanetary",
      SESSION_SECRET: "test-secret-for-vitest",
      NODE_ENV: "test",
    },
  },
  resolve: {
    alias: {
      "@triplanetary/shared": resolve("../../packages/shared/src/index.ts"),
    },
  },
});
