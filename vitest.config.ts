import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
    // Worker-thread and native-fork pools fail to initialise the runner context
    // under the Windows nvm4w Node symlink; the vm-based fork pool is stable.
    pool: "vmForks",
  },
});
