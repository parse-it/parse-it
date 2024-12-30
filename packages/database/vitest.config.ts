import { defineConfig } from "vitest/config";
import { VitePeggyPlugin } from "./src/scripts/peggy.plugin";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
  },
  plugins: [VitePeggyPlugin()],
});
