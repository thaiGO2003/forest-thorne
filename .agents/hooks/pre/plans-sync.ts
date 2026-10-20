// plans-sync: mirror agent plan documents written in plan mode
// (local://<slug>-plan.md) into .agents/plans/pending/, and let the slash command
// /plan-done <name> move a finished plan into .agents/plans/done/.
//
// Layout (user convention — see .agents/rules/plans-workflow.md):
//   .agents/plans/pending/  plan markdown đang làm / chờ duyệt
//   .agents/plans/done/     plan markdown đã hoàn tất
// Files are FLAT inside each folder; the file name is the future git branch
// name with the slashes turned into dots, three levels
// "<động-từ>.<tiêu-đề-nhánh>.<nội-dung-nhánh>.md", for example:
//   local://feat/planning-screen/font-plan.md
//     -> .agents/plans/pending/feat.planning-screen.font.md
// Legacy single-segment slugs keep the old "<slug>-plan.md" name so existing
// plan files keep working unchanged.
//
// There is no HTML rendering / index: the markdown files are the single
// source of truth.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const PLANS_DIR_SEGMENTS = [".agents", "plans"];
const CHANGELOG_FILE = "changelog.md";

function plansRoot(cwd) {
  return join(cwd, ...PLANS_DIR_SEGMENTS);
}

function sanitizeSegment(raw) {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

// A plan slug may be a single segment (legacy) or
// "<động-từ>/<tiêu-đề-nhánh>/<nội-dung-nhánh>" (user naming rule).
// Each segment is sanitized, empty segments dropped.
export function sanitizeSlugPath(raw) {
  const parts = String(raw ?? "")
    .split("/")
    .map(sanitizeSegment)
    .filter(Boolean);
  return parts.length ? parts : null;
}

// Flat plan file name: 3-level (or more) slugs join with dots; a legacy
// single-segment slug keeps the old "-plan.md" suffix.
export function planFilenameFromSegments(segments) {
  return segments.length > 1 ? `${segments.join(".")}.md` : `${segments[0]}-plan.md`;
}

function timestamp() {
  return new Date().toISOString();
}

function appendPlanChangelog(dir, message) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, CHANGELOG_FILE);
  if (!existsSync(file)) writeFileSync(file, "# Plan directory changelog\n\n", "utf8");
  appendFileSync(file, `## ${timestamp()}\n\n- ${message}\n\n`, "utf8");
}

function listPlans(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== CHANGELOG_FILE)
    .sort();
}

/* ---------------- hook factory ---------------- */

export default function plansSync(pi) {
  pi.on("tool_result", async (event, ctx) => {
    try {
      if (event.toolName !== "write" || event.isError) return;
      const path = String(event.input?.path ?? "");
      const m = path.match(/^local:\/\/(.+)-plan\.md$/);
      if (!m) return;
      const content = event.input?.content;
      if (typeof content !== "string" || !content) return;

      const segments = sanitizeSlugPath(m[1]);
      if (!segments) return;
      const root = plansRoot(ctx.cwd);
      const pendingDir = join(root, "pending");
      const doneDir = join(root, "done");
      mkdirSync(pendingDir, { recursive: true });
      mkdirSync(doneDir, { recursive: true });

      const filename = planFilenameFromSegments(segments);
      const pendingMd = join(pendingDir, filename);
      const doneMd = join(doneDir, filename);
      const existed = existsSync(pendingMd);
      // plan re-proposed with the same name: it is active again — drop stale done copy
      if (existsSync(doneMd)) unlinkSync(doneMd);

      writeFileSync(pendingMd, content, "utf8");
      appendPlanChangelog(pendingDir, `${filename} ${existed ? "updated" : "created"} by plans-sync.`);

      pi.sendMessage({
        customType: "plans-sync",
        content:
          `📋 Plan <${filename.replace(/\.md$/, "")}> đã sync → \`.agents/plans/pending/${filename}\`` +
          `${existed ? " (cập nhật)" : ""}\n` +
          `Khi hoàn tất: \`/plan-done ${filename.replace(/\.md$/, "")}\`.`,
        display: true,
      });
    } catch (err) {
      pi.logger?.warn?.("plans-sync tool_result failed", err);
    }
  });

  pi.registerCommand("plan-done", {
    description: "Chuyển plan từ .agents/plans/pending sang .agents/plans/done",
    handler: async (args, ctx) => {
      try {
        const root = plansRoot(ctx.cwd);
        const pendingDir = join(root, "pending");
        const doneDir = join(root, "done");
        const query = String(args ?? "")
          .trim()
          .replace(/\.md$/, "")
          .replace(/-plan$/, "")
          .toLowerCase();

        if (!query) {
          const pending = listPlans(pendingDir);
          const list = pending.length
            ? `Plan đang pending:\n${pending.map((f) => `- ${f} → \`/plan-done ${f.replace(/\.md$/, "")}\``).join("\n")}`
            : "Không có plan nào trong .agents/plans/pending/.";
          ctx.ui.notify(list, "info");
          return;
        }

        const all = listPlans(pendingDir);
        const file =
          all.find((f) => f.toLowerCase() === `${query}.md`) ??
          all.find((f) => f.toLowerCase() === `${query}-plan.md`) ??
          all.find((f) => f.toLowerCase().includes(query)) ??
          null;

        if (!file) {
          ctx.ui.notify(`Không tìm thấy plan "${query}" trong .agents/plans/pending/.`, "warning");
          return;
        }

        mkdirSync(doneDir, { recursive: true });
        renameSync(join(pendingDir, file), join(doneDir, file));
        appendPlanChangelog(pendingDir, `${file} moved out of pending via /plan-done.`);
        appendPlanChangelog(doneDir, `${file} moved into done via /plan-done.`);
        ctx.ui.notify(`✅ ${file} → .agents/plans/done/${file}`, "info");
      } catch (err) {
        pi.logger?.warn?.("plans-sync plan-done failed", err);
        ctx.ui.notify?.(`plan-done thất bại: ${err?.message ?? err}`, "warning");
      }
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    try {
      const root = plansRoot(ctx.cwd);
      mkdirSync(join(root, "pending"), { recursive: true });
      mkdirSync(join(root, "done"), { recursive: true });
    } catch (err) {
      pi.logger?.warn?.("plans-sync session_start failed", err);
    }
  });
}
