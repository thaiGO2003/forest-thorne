import { execFileSync } from "node:child_process";
import { defineConfig } from "vitest/config";
import pkg from "./package.json" with { type: "json" };

const mainCommitCount = Number.parseInt(
  execFileSync("git", ["rev-list", "--count", "main"], { encoding: "utf8" }).trim(),
  10
);
const mainCommitDate =
  execFileSync("git", ["log", "-1", "--format=%cs", "main"], { encoding: "utf8" }).trim();
const [major = "0", minor = "0"] = pkg.version.split(".");
const [, month = "00", day = "00"] = mainCommitDate.split("-");
const appVersion =
  major + "." + minor + "." + String(mainCommitCount).padStart(4, "0") + "-" + day + "/" + month;

export default defineConfig(({ command }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __APP_LAST_UPDATED__: JSON.stringify(mainCommitDate),
  },
  server: {
    allowedHosts: ["forest-thorne.devgovietnam.io.vn"],
    // Keep file watching for fresh transforms on F5, without updating open games.
    hmr: false,
    headers: { "Cache-Control": "no-store" },
  },
  base: command === "serve" ? "/" : "./",
  build: { target: "es2022", chunkSizeWarningLimit: 1200 },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
}));
