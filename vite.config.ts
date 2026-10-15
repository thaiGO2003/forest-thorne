import { defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: {
    allowedHosts: ["forest-thorne.devgovietnam.io.vn"],
    // Keep file watching for fresh transforms on F5, without updating open games.
    hmr: false,
    ws: false,
    headers: { "Cache-Control": "no-store" },
  },
  base: "./",
  build: { target: "es2022", chunkSizeWarningLimit: 1200 },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
