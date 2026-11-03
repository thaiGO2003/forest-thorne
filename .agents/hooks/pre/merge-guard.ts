// merge-guard: chặn merge/push vào dev|main và gh pr merge khi chưa có
// merge review APPROVED (người, hoặc agent được chủ repo uỷ quyền) cho đúng HEAD hiện tại.
//
// Quy trình: .agents/rules/merge-workflow.md
// Approval: .agents/merge-review/<branch-slug>.md với
//   Status: APPROVED
//   Head: <sha đầy đủ của nhánh nguồn>
//   Target: dev | main
//   Reviewer: <tên người duyệt>
// Thêm commit mới => Head đổi => approval cũ hết hiệu lực.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PROTECTED = new Set(["dev", "main"]);
const REVIEW_DIR = join(".agents", "merge-review");
const APPROVED_ENV = "MERGE_REVIEW_APPROVED";

function run(args: string[], cwd: string): string {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function currentBranch(cwd: string): string {
  return run(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
}

function headSha(cwd: string): string {
  return run(["rev-parse", "HEAD"], cwd);
}

function branchSlug(branch: string): string {
  return branch.replace(/[\\/]+/g, ".");
}

function readApproval(cwd: string, branch: string): string | null {
  const file = join(cwd, REVIEW_DIR, `${branchSlug(branch)}.md`);
  if (!existsSync(file)) return null;
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
}

function isApproved(cwd: string, branch: string, sha: string, target: string): boolean {
  const text = readApproval(cwd, branch);
  if (!text) return false;
  const status = /^Status:\s*APPROVED\s*$/im.test(text);
  const reviewer = /^Reviewer:\s*\S+/im.test(text);
  const targetOk = new RegExp(`^Target:\\s*${target}\\s*$`, "im").test(text);
  const head = (text.match(/^Head:\s*([0-9a-f]{7,40})\s*$/im)?.[1] ?? "").toLowerCase();
  const headOk = Boolean(head) && (sha.toLowerCase().startsWith(head) || head.startsWith(sha.toLowerCase()));
  return status && reviewer && targetOk && headOk;
}

function approvalHint(branch: string, sha: string, target: string): string {
  return [
    `MERGE BỊ CHẶN (merge-guard): chưa có merge review được duyệt cho \`${branch}\` -> \`${target}\`.`,
    `Tạo/sửa \`.agents/merge-review/${branchSlug(branch)}.md\` theo mẫu TEMPLATE.md, tối thiểu:`,
    `  Status: APPROVED`,
    `  Head: ${sha}`,
    `  Target: ${target}`,
    `  Reviewer: <tên người duyệt>`,
    "Người review phải tự duyệt; agent không được tự điền APPROVED.",
    "Quy trình đầy đủ: .agents/rules/merge-workflow.md",
  ].join("\n");
}

function firstRefAfterMerge(cmd: string): string | null {
  const m = cmd.match(/\bgit\s+merge\b([^;&|]*)/i);
  if (!m) return null;
  for (const raw of m[1].split(/\s+/)) {
    const token = raw.replace(/^['"]|['"]$/g, "");
    if (!token || token.startsWith("-")) continue;
    return token;
  }
  return null;
}

function pushDestinations(cmd: string, branch: string, remotes: string[]): string[] {
  const m = cmd.match(/\bgit\s+push\b([^;&|]*)/i);
  if (!m) return [];
  const args = m[1].split(/\s+/).map((s) => s.replace(/^['"]|['"]$/g, "")).filter(Boolean);
  const refs = args.filter((a) => !a.startsWith("-"));
  if (refs.length === 0) return [branch];
  if (refs.length === 1 && remotes.includes(refs[0])) return [branch];
  return refs.slice(1).map((refspec) => {
    const dest = refspec.includes(":") ? refspec.split(":").pop() ?? "" : refspec;
    return dest.replace(/^refs\/heads\//, "").replace(/^\+/, "");
  });
}

function pushTouchesProtected(cmd: string, branch: string, cwd: string): boolean {
  if (!/\bgit\s+push\b/i.test(cmd)) return false;
  if (/(--all|--mirror)\b/i.test(cmd)) return true;
  const remotes = run(["remote"], cwd).split("\n").filter(Boolean);
  return pushDestinations(cmd, branch, remotes).some((dest) => PROTECTED.has(dest));
}

function pushIsForce(cmd: string): boolean {
  return /\bgit\s+push\b/i.test(cmd) && /(--delete|-f\b|--force|--force-with-lease)/i.test(cmd);
}

export default function mergeGuard(pi: any) {
  pi.on("tool_call", async (event: any) => {
    try {
      if (event.toolName !== "bash") return;
      const cmd = String(event.input?.command ?? event.input?.cmd ?? "");
      if (!cmd) return;
      if (new RegExp(`${APPROVED_ENV}=1\\s+(git|gh)\\b`, "i").test(cmd)) {
        return {
          block: true,
          reason: "Không được tự set MERGE_REVIEW_APPROVED trong câu lệnh. Người review phải duyệt file trong .agents/merge-review/.",
        };
      }

      const cwd = process.cwd();
      const branch = currentBranch(cwd);
      const sha = headSha(cwd);

      if (/\bgit\s+merge\b/i.test(cmd) && /(-s|--strategy)[= ]ours\b|\s-X\s*(ours|theirs)\b/i.test(cmd)) {
        return {
          block: true,
          reason: "Không được dùng -s ours / -X ours / -X theirs để nuốt thay đổi khi merge. Giải conflict trên nhánh nguồn.",
        };
      }
      if (/\b(git\s+(merge|push)|gh\s+pr\s+merge)\b/i.test(cmd) && /--no-verify\b/i.test(cmd)) {
        return { block: true, reason: "--no-verify bị chặn cho merge/push/PR merge." };
      }

      if (/\bgit\s+merge\b/i.test(cmd)) {
        if (/\bgit\s+merge\b.*(--abort|--quit|--continue)\b/i.test(cmd)) return;
        const source = firstRefAfterMerge(cmd);
        if (!source) return;
        const sourceBranch = source.replace(/^origin\//, "");
        const sourceSha = run(["rev-parse", source], cwd);
        const syncingFromUpstream = !PROTECTED.has(branch) && /^(origin\/)?(dev|main)$/.test(source);
        if (syncingFromUpstream) return;

        const target = branch;
        if (!isApproved(cwd, sourceBranch, sourceSha || sha, target)) {
          return { block: true, reason: approvalHint(sourceBranch, sourceSha || sha, target) };
        }
        return;
      }

      if (/\bgh\s+pr\s+merge\b/i.test(cmd)) {
        if (/--admin\b/i.test(cmd)) {
          return { block: true, reason: "gh pr merge --admin bị chặn: phải qua review theo .agents/rules/merge-workflow.md." };
        }
        const target = PROTECTED.has(branch) ? branch : "dev";
        if (!isApproved(cwd, branch, sha, target)) {
          return { block: true, reason: approvalHint(branch, sha, target) };
        }
        return;
      }

      if (/\bgit\s+push\b/i.test(cmd)) {
        if (process.env[APPROVED_ENV] === "1") return;
        const touchesProtected = pushTouchesProtected(cmd, branch, cwd);
        if (touchesProtected && pushIsForce(cmd)) {
          return { block: true, reason: "Force/--delete/--all/--mirror lên dev|main bị chặn tuyệt đối." };
        }
        if (!touchesProtected) return;
        if (!isApproved(cwd, branch, sha, branch)) {
          return { block: true, reason: approvalHint(branch, sha, branch) };
        }
      }
    } catch (err) {
      try {
        pi.logger?.warn?.("merge-guard failed closed?", err);
      } catch {}
      return {
        block: true,
        reason: "merge-guard lỗi khi kiểm tra merge review; fail-closed. Chạy lại hoặc báo người dùng.",
      };
    }
  });
}
