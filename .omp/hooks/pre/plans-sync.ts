// plans-sync: mirror agent plan documents (plan mode: local://<slug>-plan.md)
// into .omp/plans/pending/ as the standard agent plan, render a readable HTML
// copy into .omp/plans/custom/html/ using the single shared stylesheet
// .omp/plans/custom/plan.css, and maintain an index page.
//
// Slash command /plan-done <slug> moves a plan from pending/ to done/ once its
// work is finished and re-renders the HTML with a DONE badge.
//
// Conventions (see .omp/AGENTS.md):
//   .omp/plans/pending/  — plan markdown chuẩn của agent, chờ duyệt / đang làm
//   .omp/plans/done/     — plan markdown đã hoàn tất
//   .omp/plans/custom/   — trang HTML đọc được + plan.css dùng chung (1 CSS duy nhất)
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PLANS_DIR_SEGMENTS = [".omp", "plans"];
const CHANGELOG_FILE = "changelog.md";

function plansRoot(cwd) {
  return join(cwd, ...PLANS_DIR_SEGMENTS);
}

function sanitizeSlug(raw) {
  const slug = String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "plan";
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

function extractTitle(md, slug) {
  const m = String(md).match(/^\s*#\s+(.+)$/m);
  if (m) return m[1].trim();
  // humanize slug the same way omp names approved plans: separators → spaces
  const t = String(slug ?? "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "Plan";
}

/* ---------------- page templates ---------------- */

function renderPlanPage({ title, status, bodyHtml, updated }) {
  const badge = status === "done"
    ? '<span class="badge badge-done">✅ Done</span>'
    : '<span class="badge badge-pending">⏳ Pending</span>';
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>${escapeHtml(title)} — Forest Throne plan</title>
  <link rel="stylesheet" href="../plan.css" />
</head>
<body>
  <div class="doc">
    <div class="doc-head">
      <h1>${escapeHtml(title)}</h1>
      <div class="doc-meta">
        ${badge}
        <span>Cập nhật ${escapeHtml(updated)}</span>
        <span>·</span>
        <span>bản markdown: <code>.omp/plans/${status === "done" ? "done" : "pending"}/</code></span>
        <span>·</span>
        <a href="./agent-index.html">← Tất cả plan</a>
      </div>
    </div>
${bodyHtml}
  </div>
</body>
</html>
`;
}

function listPlanRows(dir, htmlDir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f !== CHANGELOG_FILE)
    .map((f) => {
      const full = join(dir, f);
      const htmlName = f.replace(/\.md$/, ".html");
      return {
        name: f,
        htmlName,
        htmlExists: existsSync(join(htmlDir, htmlName)),
        mtime: existsSync(full) ? statSync(full).mtimeMs : 0,
      };
    })
    .sort((a, b) => b.mtime - a.mtime);
}

function renderIndex({ pending, done, customPages, updated }) {
  const section = (title, rows) => {
    const items = rows.length
      ? rows
          .map((r) =>
            r.htmlExists
              ? `<a href="./${r.htmlName}">${escapeHtml(r.name.replace(/\.md$/, ""))}<small>${escapeHtml(new Date(r.mtime).toISOString().slice(0, 10))}</small></a>`
              : `<a class="empty">${escapeHtml(r.name)}<small>chưa render HTML</small></a>`,
          )
          .join("\n      ")
      : `<span class="empty">(trống)</span>`;
    return `<h2>${title}</h2>\n    <div class="plan-list">\n      ${items}\n    </div>`;
  };

  const customLinks = customPages
    .filter((p) => existsSync(p.file))
    .map((p) => `<a href="./${p.name}">${p.label}<small>viết tay</small></a>`)
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
        <span>Plan markdown chuẩn của agent: <code>.omp/plans/pending</code> + <code>.omp/plans/done</code></span>
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

function writeHtml(htmlDir, name, content) {
  mkdirSync(htmlDir, { recursive: true });
  writeFileSync(join(htmlDir, name), content, "utf8");
}

/* ---------------- hook factory ---------------- */

export default function plansSync(pi) {
  const syncIndex = (cwd) => {
    try {
      const root = plansRoot(cwd);
      const htmlDir = join(root, "custom", "html");
      const pending = listPlanRows(join(root, "pending"), htmlDir);
      const done = listPlanRows(join(root, "done"), htmlDir);
      const customPages = [
        { name: "plan.html", label: "plan.html — thống kê + kế hoạch tổng quan", file: join(htmlDir, "plan.html") },
        { name: "plan-code.html", label: "plan-code.html — plan code v2 (stack + modding)", file: join(htmlDir, "plan-code.html") },
      ];
      writeHtml(htmlDir, "agent-index.html", renderIndex({ pending, done, customPages, updated: today() }));
    } catch (err) {
      pi.logger?.warn?.("plans-sync index failed", err);
    }
  };

  const renderPlan = (cwd, slug, md, status) => {
    const root = plansRoot(cwd);
    const htmlDir = join(root, "custom", "html");
    const body = mdToHtml(md);
    const title = extractTitle(md, slug);
    writeHtml(htmlDir, `${slug}-plan.html`, renderPlanPage({ title, status, bodyHtml: body, updated: today() }));
  };

  pi.on("tool_result", async (event, ctx) => {
    try {
      if (event.toolName !== "write" || event.isError) return;
      const path = String(event.input?.path ?? "");
      const m = path.match(/^local:\/\/(.+)-plan\.md$/);
      if (!m) return;
      const content = event.input?.content;
      if (typeof content !== "string" || !content) return;

      const slug = sanitizeSlug(m[1]);
      const root = plansRoot(ctx.cwd);
      const pendingDir = join(root, "pending");
      const doneDir = join(root, "done");
      mkdirSync(pendingDir, { recursive: true });
      mkdirSync(doneDir, { recursive: true });

      const existed = existsSync(join(pendingDir, `${slug}-plan.md`));
      // plan re-proposed with the same slug: it is active again — drop stale done copy
      const staleDone = join(doneDir, `${slug}-plan.md`);
      if (existsSync(staleDone)) unlinkSync(staleDone);

      writeFileSync(join(pendingDir, `${slug}-plan.md`), content, "utf8");
      renderPlan(ctx.cwd, slug, content, "pending");
      appendPlanChangelog(
        pendingDir,
        `${slug}-plan.md ${existed ? "updated" : "created"} by plans-sync.`
      );
      appendPlanChangelog(
        join(root, "custom", "html"),
        `${slug}-plan.html rendered from pending source.`
      );
      syncIndex(ctx.cwd);

      pi.sendMessage({
        customType: "plans-sync",
        content:
          `📋 Plan <${slug}> đã sync → \`.omp/plans/pending/${slug}-plan.md\`` +
          `${existed ? " (cập nhật)" : ""}\n` +
          `Bản đọc: \`.omp/plans/custom/html/${slug}-plan.html\` · Index: \`agent-index.html\`. ` +
          `Khi hoàn tất: \`/plan-done ${slug}\`.`,
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
        const query = sanitizeSlug(String(args ?? "").replace(/\.md$/, "").replace(/-plan$/, ""));

        if (!query || query === "plan") {
          const pending = existsSync(pendingDir)
            ? readdirSync(pendingDir).filter((f) => f.endsWith(".md") && f !== CHANGELOG_FILE)
            : [];
          const list = pending.length
            ? `Plan đang pending:\n${pending.map((f) => `- ${f.replace(/\.md$/, "")} → \`/plan-done ${f.replace(/-plan\.md$/, "")}\``).join("\n")}`
            : "Không có plan nào trong .omp/plans/pending/.";
          ctx.ui.notify(list, "info");
          return;
        }

        const candidates = [`plan-done: ${query}-plan.md`, `${query}-plan.md`, `${query}.md`];
        let file = null;
        if (existsSync(pendingDir)) {
          const files = readdirSync(pendingDir).filter((f) => f.endsWith(".md") && f !== CHANGELOG_FILE);
          file =
            files.find((f) => candidates.includes(f)) ??
            files.find((f) => f.toLowerCase().includes(query)) ??
            null;
        }
        if (!file) {
          ctx.ui.notify(`Không tìm thấy plan "${query}" trong .omp/plans/pending/.`, "warning");
          return;
        }

        const md = readFileSync(join(pendingDir, file), "utf8");
        const slug = file.replace(/\.md$/, "").replace(/-plan$/, "");
        mkdirSync(doneDir, { recursive: true });
        renameSync(join(pendingDir, file), join(doneDir, file));
        renderPlan(ctx.cwd, slug, md, "done");
        appendPlanChangelog(pendingDir, `${file} moved out of pending via /plan-done.`);
        appendPlanChangelog(doneDir, `${file} moved into done via /plan-done.`);
        appendPlanChangelog(
          join(root, "custom", "html"),
          `${slug}-plan.html re-rendered with DONE status.`
        );
        syncIndex(ctx.cwd);
        ctx.ui.notify(
          `✅ ${file} → .omp/plans/done/. HTML cập nhật: .omp/plans/custom/html/${slug}-plan.html`,
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
