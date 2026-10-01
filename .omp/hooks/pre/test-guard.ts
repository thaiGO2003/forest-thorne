// test-guard: chặn full test suite không filter — sửa 1 tí không được chạy hết.
// Chỉ cho qua khi lệnh có filter targeted (file/thư mục test, -t, --changed,
// --related, --testNamePattern, --project) hoặc có ALLOW_FULL_TESTS=1.
// Hook chặn ở runtime vì rule markdown agent lười vẫn bỏ qua (bài học advisor).

const FULL_RUNNERS = [/(^|\s)(pnpm|npm|yarn)(\s+run)?\s+test(\s|$)/, /(^|\s)vitest(\s|$)/];

function hasTargetFilter(cmd) {
  if (/(--changed|--related|--testNamePattern|--project|-t\s|["']-t["']|--testPathPattern)/.test(cmd)) return true;
  // positional filter: đường dẫn file/thư mục test hoặc pattern *.test.*
  const m = cmd.match(/(^|\s|["'])([\w./@~-]+(\.test\.[jt]s|_test\.[jt]s|__tests__|[\\/]tests?[\\/])[\w./-]*)(["']|\s|$)/);
  if (m) return true;
  if (/\.test\.[jt]sx?/.test(cmd)) return true;
  return false;
}

function isFullSuite(cmd) {
  const c = String(cmd ?? "");
  if (!c) return false;
  if (!FULL_RUNNERS.some((re) => re.test(c))) return false;
  // pnpm test -- <filter> vẫn cho qua nếu có filter sau --
  if (hasTargetFilter(c)) return false;
  return true;
}

const HEAVY_HINT = [
  "threeMobileE2EFullFlow", "threeFullFlow", "threeMultiModeE2E",
  "threeMobileResponsivenessAudit", "liveShopRewriteRuntime",
].join(", ");

export default function testGuard(pi) {
  pi.on("tool_call", async (event) => {
    try {
      if (event.toolName !== "bash") return;
      const cmd = String(event.input?.command ?? event.input?.cmd ?? "");
      if (!isFullSuite(cmd)) return;
      if (process.env.ALLOW_FULL_TESTS === "1") return;
      return {
        block: true,
        reason:
          "FULL TEST SUITE BỊ CHẶN (test-guard): repo có 150+ test files, chạy hết sau mỗi sửa nhỏ vừa lâu vừa dễ OOM máy 7 GB. " +
          "Chạy targeted thay thế:\n" +
          "- 1 file: pnpm exec vitest --run tests/runtime/<ten-file>.test.ts\n" +
          "- 1 test: thêm -t \"<tên test>\"\n" +
          "- file vừa đổi (git): pnpm run test:changed\n" +
          "- test nặng E2E (" + HEAVY_HINT + ") chỉ chạy khi đụng đúng vùng đó.\n" +
          "Chỉ chạy full suite khi đổi shared runtime/hạ tầng (vitest.config, setup.js, tests/setup) " +
          "và phải set ALLOW_FULL_TESTS=1.",
      };
    } catch (err) {
      try {
        pi.logger?.warn?.("test-guard failed open", err);
      } catch {}
      return;
    }
  });
}
