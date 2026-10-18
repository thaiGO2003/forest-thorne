// plans-sync: mirror agent plan documents (plan mode: local://<slug>-plan.md)
// into .omp/plans/pending/ as the standard agent plan, render a readable HTML
// copy into .omp/plans/custom/html/ using the single shared stylesheet
// .omp/plans/custom/plan.css, and maintain an index page.
//
// Slash command /plan-done <slug> moves a plan from pending/ to done/ once its
// work is finished and re-renders the HTML with a DONE badge.
//
// Naming (user convention — see .omp/rules/plans-workflow.md):
//   plan filenames are "<verb>/<group>/<content>" — exactly the future git
//   branch name for the work, e.g.
//     local://feat/planning-screen/font-plan.md
//       -> .omp/plans/pending/feat/planning-screen/font.md
//       -> custom/html/pending/feat/planning-screen/font.html
//   Legacy single-segment slugs keep the old flat layout
//   (.omp/plans/pending/<slug>-plan.md, html next to agent-index.html) so
//   existing plan files keep working unchanged.
//
// Conventions (see .omp/AGENTS.md):
//   .omp/plans/pending/  — plan markdown chuẩn của agent, chờ duyệt / đang làm
//   .omp/plans/done/     — plan markdown đã hoàn tất
//   .omp/plans/custom/   — trang HTML đọc được + plan.css dùng chung (1 CSS duy nhất)
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const PLANS_DIR_SEGMENTS = [".omp", "plans"];
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

// A plan slug may be a single segment (legacy) or "<verb>/<group>/<content>"
// (user naming rule). Each segment is sanitized, empty segments removed.
export function sanitizeSlugPath(raw) {
  const parts = String(raw ?? "").split("/").map(sanitizeSegment).filter(Boolean);
  return parts.length ? parts : null;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function timestamp() {
  return new Date().toISOString();
}

function appendPlanChangelog(dir, message) {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, CHANGELOG_FILE);
  if (!existsSync(file)) {
    writeFileSync(file, "# Plan directory changelog\n\n", "utf8");
  }
  appendFileSync(file, `## ${timestamp()}\n\n- ${message}\n\n`, "utf8");
}

/* ---------------- markdown → HTML (dependency-free) ---------------- */

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function inlineMd(raw) {
  let text = String(raw);
  // extract code spans first so syntax inside them is left alone
  const codes = [];
  text = text.replace(/`([^`]+)`/g, (_m, code) => {
    codes.push(`<code>${escapeHtml(code)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  text = escapeHtml(text);
  text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, alt, src) => `<img src="${src}" alt="${alt}" />`);
  text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => `<a href="${href}">${label}</a>`);
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");
  text = text.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");
  text = text.replace(/\u0000(\d+)\u0000/g, (_m, i) => codes[Number(i)]);
  return text;
}

function renderListBlock(lines) {
  // lines: consecutive list-item lines (possibly indented). Returns HTML.
  const stack = []; // { type: "ul"|"ol", indent }
  let out = "";
  let lastLi = null;

  const closeTo = (depth) => {
    while (stack.length > depth) {
      const frame = stack.pop();
      if (lastLi) {
        out += lastLi;
        lastLi = null;
      }
      out += frame.type === "ol" ? "</ol>" : "</ul>";
    }
  };

  for (const line of lines) {
    const m = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/);
    if (!m) {
      // continuation line: append to the most recent <li>
      if (lastLi && /^\s{2,}\S/.test(line)) lastLi += " " + inlineMd(line.trim());
      continue;
    }
    const indent = m[1].replace(/\t/g, "    ").length;
    const ordered = /\d/.test(m[2]);
    let content = m[3];

    let taskHtml = "";
    const task = content.match(/^\[( |x|X)\]\s+(.*)$/);
    if (task) {
      const done = task[1].toLowerCase() === "x";
      content = task[2];
      taskHtml = done
        ? `<span class="task-box">☑</span><span class="task-text">`
        : `<span class="task-box">☐</span><span class="task-text">`;
    }

    // pop frames deeper than this indent
    while (stack.length && stack[stack.length - 1].indent > indent) closeTo(stack.length - 1);

    const top = stack[stack.length - 1];
    if (!top || top.indent < indent || (top.indent === indent && top.type !== (ordered ? "ol" : "ul"))) {
      if (lastLi) {
        out += lastLi;
        lastLi = null;
      }
      const type = ordered ? "ol" : "ul";
      if (top && top.indent === indent && top.type !== type) closeTo(stack.length - 1);
      out += type === "ol" ? "<ol>" : "<ul>";
      stack.push({ type, indent });
    } else if (lastLi) {
      out += lastLi;
      lastLi = null;
    }

    const body = inlineMd(content);
    lastLi = taskHtml ? `<li class="task${task[1].toLowerCase() === "x" ? " task-done" : ""}">${taskHtml}${body}</span></li>` : `<li>${body}</li>`;
  }
  closeTo(0);
  return out;
}

function mdToHtml(md) {
  const lines = String(md).replace(/\r\n?/g, "\n").split("\n");
  let out = "";
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    const fence = line.match(/^\s*```\s*(\S*)\s*$/);
    if (fence) {
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        buf.push(lines[i]);
        i++;
      }
      i++; // closing fence (or EOF)
      out += `<pre><code>${escapeHtml(buf.join("\n"))}</code></pre>\n`;
      continue;
    }

    // heading
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      out += `<h${level}>${inlineMd(heading[2].replace(/\s*#+\s*$/, ""))}</h${level}>\n`;
      i++;
      continue;
    }

    // horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out += "<hr />\n";
      i++;
      continue;
    }

    // blockquote
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      out += `<blockquote>${mdToHtml(buf.join("\n"))}</blockquote>\n`;
      continue;
    }

    // table: header | header, then a |---| separator
    if (/^\s*\|.*\|\s*$/.test(line) && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1])) {
      const splitRow = (row) =>
        row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      out += "<table><thead><tr>";
      for (const cell of header) out += `<th>${inlineMd(cell)}</th>`;
      out += "</tr></thead><tbody>";
      for (const row of rows) {
        out += "<tr>";
        for (const cell of row) out += `<td>${inlineMd(cell)}</td>`;
        out += "</tr>";
      }
      out += "</tbody></table>\n";
      continue;
    }

    // list block
    if (/^\s*([-*+]|\d+[.)])\s+/.test(line)) {
      const buf = [];
      while (i < lines.length) {
        const isMarker = /^\s*([-*+]|\d+[.)])\s+/.test(lines[i]);
        const isContinuation = /^\s{2,}\S/.test(lines[i]) && buf.length > 0;
        if (!isMarker && !isContinuation) break;
        buf.push(lines[i]);
        i++;
      }
      out += renderListBlock(buf) + "\n";
      continue;
    }

    // blank line
    if (!/\S/.test(line)) {
      i++;
      continue;
    }

    // paragraph
    const buf = [];
    while (i < lines.length && /\S/.test(lines[i]) &&
      !/^\s*```/.test(lines[i]) && !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i]) && !/^\s*>/.test(lines[i]) &&
      !/^\s*\|.*\|\s*$/.test(lines[i]) && !/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    if (buf.length) out += `<p>${buf.map(inlineMd).join("<br />")}</p>\n`;
    else i++; // safety: never stall
  }
  return out;
}

function extractTitle(md, mdRel) {
  const m = String(md).match(/^\s*#\s+(.+)$/m);
  if (m) return m[1].trim();
  // humanize the leaf the same way omp names approved plans
  const leaf = String(mdRel ?? "").split("/").filter(Boolean).pop() ?? "";
  const t = leaf.replace(/\.md$/, "").replace(/-plan$/, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Plan";
}

/* ---------------- grouped plan locations ---------------- */

// A plan is either legacy-flat (no slash in the mirror slug) or grouped by the
// user's "<verb>/<group>/<content>" naming. Everything derived downstream
// (markdown path, html path, css depth, index hrefs) flows from these helpers.

function parentOf(fullPath) {
  const cut = Math.max(fullPath.lastIndexOf("\\"), fullPath.lastIndexOf("/"));
  return cut > 0 ? fullPath.slice(0, cut) : join(fullPath, "..");
}

function htmlRelFromMdRel(status, mdRel) {
  // mdRel uses "/" separators. Every rendered page mounts under pending/ or
  // done/ so custom/html has exactly two groups (user convention).
  const cut = mdRel.lastIndexOf("/");
  const leaf = mdRel.slice(cut + 1).replace(/\.md$/, "");
  const mid = !mdRel.includes("/") ? "" : `${mdRel.slice(0, cut)}/`;
  return `${status}/${mid}${leaf}.html`;
}

function cssHrefFromHtmlRel(htmlRel) {
  // page sits at custom/html/<htmlRel>; stylesheet at custom/plan.css
  const depth = htmlRel.split("/").length - 1; // directories above the page
  return `${"../".repeat(depth + 1)}plan.css`;
}

function indexHrefForPage(htmlRel) {
  return `${"../".repeat(htmlRel.split("/").length - 1)}agent-index.html`;
}

function readDirRecursive(root) {
  const out = [];
  if (!existsSync(root)) return out;
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(full);
    }
  };
  walk(root);
  return out;
}

/* ---------------- page templates ---------------- */

function renderPlanPage({ title, status, bodyHtml, updated, htmlRel, mdRel }) {
  const badge = status === "done"
    ? '<span class="badge badge-done">✅ Done</span>'
    : '<span class="badge badge-pending">⏳ Pending</span>';
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${escapeHtml(title)} — Forest Throne plan</title>
  <link rel="stylesheet" href="${cssHrefFromHtmlRel(htmlRel)}" />
</head>
<body>
  <div class="doc">
    <div class="doc-head">
      <h1>${escapeHtml(title)}</h1>
      <div class="doc-meta">
        ${badge}
        <span>Cập nhật ${escapeHtml(updated)}</span>
        <span>·</span>
        <span>bản markdown: <code>.omp/plans/${status === "done" ? "done" : "pending"}/${escapeHtml(mdRel)}</code></span>
        <span>·</span>
        <a href="${indexHrefForPage(htmlRel)}">← Tất cả plan</a>
      </div>
    </div>
${bodyHtml}
  </div>
</body>
</html>
`;
}

function listPlanRows(statusDir, htmlDir, status) {
  if (!existsSync(statusDir)) return [];
  return readDirRecursive(statusDir)
    .filter((f) => f.endsWith(".md") && f !== CHANGELOG_FILE)
    .map((f) => {
      const base = f.split(/[\\/]/).pop() ?? "";
      if (base === CHANGELOG_FILE) return null;
      const rel = f.slice(statusDir.length + 1).split("\\").join("/");
      const htmlRel = htmlRelFromMdRel(status, rel);
      return {
        name: rel,
        htmlRel,
        htmlHref: `./${htmlRel}`,
        htmlExists: existsSync(join(htmlDir, htmlRel)),
        mtime: statSync(f).mtimeMs,
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime);
}

function renderIndex({ pending, done, customPages, updated }) {
  const section = (title, rows) => {
    const items = rows.length
      ? rows
          .map((r) =>
            r.htmlExists
              ? `<a href="${r.htmlHref}">${escapeHtml(r.name.replace(/\.md$/, ""))}<small>${escapeHtml(new Date(r.mtime).toISOString().slice(0, 10))}</small></a>`
              : `<a class="empty">${escapeHtml(r.name)}<small>chưa render HTML</small></a>`,
          )
          .join("\n      ")
      : `<span class="empty">(trống)</span>`;
    return `<h2>${title}</h2>\n    <div class="plan-list">\n      ${items}\n    </div>`;
  };

  const customLinks = customPages
    .filter((p) => existsSync(p.file))
    .map((p) => `<a href="${p.href}">${p.label}<small>viết tay</small></a>`)
    .join("\n      ");

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>Forest Throne — Plans</title>
  <link rel="stylesheet" href="../plan.css" />
</head>
<body>
  <div class="doc">
    <div class="doc-head">
      <h1>🌲 Forest Throne — Plans</h1>
      <div class="doc-meta">
        <span>Plan markdown chuẩn của agent: <code>.omp/plans/pending</code> + <code>.omp/plans/done</code> (đặt tên <code>động từ/group/nội dung</code>)</span>
        <span>·</span>
        <span>Cập nhật ${escapeHtml(updated)}</span>
      </div>
    </div>
    ${section("⏳ Pending", pending)}
    ${section("✅ Done", done)}
    <h2>🎨 Custom (viết tay)</h2>
    <div class="plan-list">
      ${customLinks || '<span class="empty">(trống)</span>'}
    </div>
  </div>
</body>
</html>
`;
}

function writeHtml(htmlDir, htmlRel, content) {
  const full = join(htmlDir, htmlRel);
  mkdirSync(parentOf(full), { recursive: true });
  writeFileSync(full, content, "utf8");
}

/* ---------------- hook factory ---------------- */

export default function plansSync(pi) {
  const syncIndex = (cwd) => {
    try {
      const root = plansRoot(cwd);
      const htmlDir = join(root, "custom", "html");
      const pending = listPlanRows(join(root, "pending"), htmlDir, "pending");
      const done = listPlanRows(join(root, "done"), htmlDir, "done");
      const customPages = [
        { label: "pending/wbs.html — WBS 93 tasks theo Mega Prompt V3", href: "./pending/wbs.html", file: join(htmlDir, "pending", "wbs.html") },
        { label: "pending/forest-throne-v5-enhancement-master-plan.html — master plan v5", href: "./pending/forest-throne-v5-enhancement-master-plan.html", file: join(htmlDir, "pending", "forest-throne-v5-enhancement-master-plan.html") },
        { label: "done/remaining-menu-utilities-plan.html — menu utilities (hoàn tất)", href: "./done/remaining-menu-utilities-plan.html", file: join(htmlDir, "done", "remaining-menu-utilities-plan.html") },
      ];
      writeHtml(htmlDir, "agent-index.html", renderIndex({ pending, done, customPages, updated: today() }));
    } catch (err) {
      pi.logger?.warn?.("plans-sync index failed", err);
    }
  };

  const pageMdRelFromSegments = (segments) =>
    segments.length > 1 ? `${segments.join("/")}.md` : `${segments[0]}-plan.md`;

  const renderPlanFromMd = (cwd, mdRel, md, status) => {
    const root = plansRoot(cwd);
    const htmlDir = join(root, "custom", "html");
    const body = mdToHtml(md);
    const title = extractTitle(md, mdRel);
    const htmlRel = htmlRelFromMdRel(status, mdRel);
    writeHtml(htmlDir, htmlRel, renderPlanPage({ title, status, bodyHtml: body, updated: today(), htmlRel, mdRel }));
    return htmlRel;
  };

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

      const mdRel = pageMdRelFromSegments(segments);
      const pendingMd = join(pendingDir, ...mdRel.split("/"));
      const doneMd = join(doneDir, ...mdRel.split("/"));
      const existed = existsSync(pendingMd);
      // plan re-proposed with the same slug: it is active again — drop stale done copy
      if (existsSync(doneMd)) unlinkSync(doneMd);
      mkdirSync(parentOf(pendingMd), { recursive: true });

      writeFileSync(pendingMd, content, "utf8");
      const htmlRel = renderPlanFromMd(ctx.cwd, mdRel, content, "pending");
      appendPlanChangelog(pendingDir, `${mdRel} ${existed ? "updated" : "created"} by plans-sync.`);
      appendPlanChangelog(
        join(root, "custom", "html"),
        `custom/html/${htmlRel} rendered from pending source.`,
      );
      syncIndex(ctx.cwd);

      pi.sendMessage({
        customType: "plans-sync",
        content:
          `📋 Plan <${mdRel.replace(/\.md$/, "")}> đã sync → \`.omp/plans/pending/${mdRel}\`` +
          `${existed ? " (cập nhật)" : ""}\n` +
          `Bản đọc: \`.omp/plans/custom/html/${htmlRel}\`. ` +
          `Khi hoàn tất: \`/plan-done ${mdRel.replace(/\.md$/, "")}\`.`,
        display: true,
      });
    } catch (err) {
      pi.logger?.warn?.("plans-sync tool_result failed", err);
    }
  });

  pi.registerCommand("plan-done", {
    description: "Chuyển plan từ .omp/plans/pending sang done và cập nhật HTML",
    handler: async (args, ctx) => {
      try {
        const root = plansRoot(ctx.cwd);
        const pendingDir = join(root, "pending");
        const doneDir = join(root, "done");
        const query = String(args ?? "").replace(/\.md$/, "").replace(/-plan$/, "").toLowerCase();

        if (!query) {
          const pending = readDirRecursive(pendingDir)
            .filter((f) => f.endsWith(".md") && f !== CHANGELOG_FILE)
            .map((f) => f.slice(pendingDir.length + 1).split("\\").join("/"));
          const list = pending.length
            ? `Plan đang pending:\n${pending.map((f) => `- ${f} → \`/plan-done ${f.replace(/\.md$/, "")}\``).join("\n")}`
            : "Không có plan nào trong .omp/plans/pending/.";
          ctx.ui.notify(list, "info");
          return;
        }

        // candidates: exact rel path, exact leaf, then substring on the leaf
        const all = readDirRecursive(pendingDir).filter((f) => f.endsWith(".md") && f !== CHANGELOG_FILE);
        const relOf = (f) => f.slice(pendingDir.length + 1).split("\\").join("/").toLowerCase();
        const leafOf = (f) => relOf(f).slice(relOf(f).lastIndexOf("/") + 1);
        let file = null;
        if (all.length) {
          file =
            all.find((f) => relOf(f) === `${query}.md`) ??
            all.find((f) => leafOf(f) === `${query}.md`) ??
            all.find((f) => leafOf(f) === `${query}-plan.md`) ??
            all.find((f) => leafOf(f).includes(query)) ??
            null;
        }
        if (!file) {
          ctx.ui.notify(`Không tìm thấy plan "${query}" trong .omp/plans/pending/.`, "warning");
          return;
        }

        const md = readFileSync(file, "utf8");
        const rel = file.slice(pendingDir.length + 1).split("\\").join("/");
        const mdRelNoMd = rel.replace(/\.md$/, "");
        mkdirSync(doneDir, { recursive: true });
        const doneFile = join(doneDir, ...rel.split("/"));
        mkdirSync(parentOf(doneFile), { recursive: true });
        renameSync(file, doneFile);
        const htmlRel = renderPlanFromMd(ctx.cwd, rel, md, "done");
        // drop the stale pending page so custom/html keeps only live groups
        try { unlinkSync(join(join(root, "custom", "html"), htmlRelFromMdRel("pending", rel))); } catch {}
        appendPlanChangelog(pendingDir, `${rel} moved out of pending via /plan-done.`);
        appendPlanChangelog(doneDir, `${rel} moved into done via /plan-done.`);
        appendPlanChangelog(
          join(root, "custom", "html"),
          `custom/html/${htmlRel} re-rendered with DONE status.`,
        );
        syncIndex(ctx.cwd);
        ctx.ui.notify(
          `✅ ${rel} → .omp/plans/done/${rel}. HTML cập nhật: .omp/plans/custom/html/${htmlRel}`,
          "info",
        );
      } catch (err) {
        pi.logger?.warn?.("plans-sync plan-done failed", err);
        ctx.ui.notify?.(`plan-done thất bại: ${err?.message ?? err}`, "warning");
      }
    },
  });

  pi.on("session_start", async (_event, ctx) => {
    syncIndex(ctx.cwd);
  });
}
