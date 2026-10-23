/**
 * @file index.js — Orchestrator cho Documentation System.
 *
 * Wire tất cả components lại: Analyzer → Generator → Translator → Writer.
 * Quét directory, phân tích files, sinh documentation, ghi vào files.
 */

import { readFile } from "fs/promises";
import { analyzeSource, discoverJsFiles } from "./CodeAnalyzer.js";
import { generateFileHeader, generateFunctionDoc, generateInlineComment, generateBlockComment } from "./DocumentationGenerator.js";
import { translateComment, detectLanguage } from "./CommentTranslator.js";
import { applyAllChanges, writeDocumentation } from "./DocumentationWriter.js";
import { createDocumentationReport, type DocumentationChanges, type DocumentationReport } from "./models.js";

export interface ProcessSourceOpts {
    translateExisting?: boolean;
}

export interface ProcessDirectoryOpts extends ProcessSourceOpts {
    dryRun?: boolean;
    exclude?: string[];
    priorityPaths?: string[];
}

/**
 * Xử lý một file: phân tích → sinh documentation → trả về changes.
 * @param {string} source - Nội dung file
 * @param {string} filePath - Đường dẫn file
 * @param {Object} [opts] - Tùy chọn
 * @param {boolean} [opts.translateExisting] - Dịch comments EN→VI hiện có
 * @returns {{ source: string, changes: Object, analysis: Object }}
 */
export function processSource(source: string, filePath: string = "<unknown>", opts: ProcessSourceOpts = {}) {
    const analysis = analyzeSource(source, filePath);
    const changes: DocumentationChanges = {
        header: null,
        functionDocs: [],
        inlineComments: [],
        blockComments: []
    };

    // 1. File header
    if (!analysis.hasHeader) {
        changes.header = generateFileHeader(analysis);
    }

    // 2. Function documentation
    for (const fn of analysis.functions) {
        if (!fn.hasJSDoc) {
            const jsdoc = generateFunctionDoc(fn);
            changes.functionDocs.push({ line: fn.line, jsdoc });
        }
    }

    // 3. Class method documentation
    for (const cls of analysis.classes) {
        for (const method of cls.methods) {
            if (!method.hasJSDoc) {
                const jsdoc = generateFunctionDoc(method);
                changes.functionDocs.push({ line: method.line, jsdoc });
            }
        }
    }

    // 4. Complex block comments
    for (const block of analysis.complexBlocks) {
        if (!block.hasComment) {
            if (block.complexity >= 5 || block.nestingDepth >= 3) {
                const comment = generateBlockComment(block);
                changes.blockComments.push({ line: block.startLine, comment });
            } else {
                const comment = generateInlineComment(block);
                changes.inlineComments.push({ line: block.startLine, comment });
            }
        }
    }

    // 5. Apply changes
    const newSource = applyAllChanges(source, changes);

    return { source: newSource, changes, analysis };
}

/**
 * Xử lý toàn bộ directory.
 * @param {string} dir - Đường dẫn thư mục
 * @param {Object} [opts] - Tùy chọn
 * @param {boolean} [opts.dryRun] - Chỉ phân tích, không ghi file
 * @param {string[]} [opts.exclude] - Patterns exclude
 * @param {string[]} [opts.priorityPaths] - Thư mục ưu tiên
 * @returns {Promise<import("./models.js").DocumentationReport>}
 */
export async function processDirectory(dir: string, opts: ProcessDirectoryOpts = {}): Promise<DocumentationReport> {
    const report = createDocumentationReport();

    try {
        const files = await discoverJsFiles(dir, {
            exclude: opts.exclude ?? ["node_modules", "dist", ".git", "coverage", "tests"],
            priorityPaths: opts.priorityPaths ?? ["src/core", "src/systems"]
        });

        report.totalFiles = files.length;

        for (const filePath of files) {
            try {
                const source = await readFile(filePath, "utf-8");
                const { changes, analysis } = processSource(source, filePath, opts);

                const changesCount = (changes.header ? 1 : 0)
                    + changes.functionDocs.length
                    + changes.inlineComments.length
                    + changes.blockComments.length;

                if (changesCount === 0) {
                    report.skippedFiles++;
                    report.fileDetails.push({ filePath, status: "skipped", changes: [] });
                    continue;
                }

                report.totalFunctions += analysis.functions.length;
                report.documentedFunctions += analysis.functions.filter(f => f.hasJSDoc).length;
                report.undocumentedFunctions += analysis.functions.filter(f => !f.hasJSDoc).length;

                if (changes.header) report.headersAdded++;
                report.inlineCommentsAdded += changes.inlineComments.length;
                report.blockCommentsAdded += changes.blockComments.length;

                const changesList = [];
                if (changes.header) changesList.push("header");
                if (changes.functionDocs.length) changesList.push(`${changes.functionDocs.length} JSDoc`);
                if (changes.inlineComments.length) changesList.push(`${changes.inlineComments.length} inline`);
                if (changes.blockComments.length) changesList.push(`${changes.blockComments.length} block`);

                if (!opts.dryRun) {
                    const result = await writeDocumentation(filePath, changes);
                    if (result.success) {
                        report.processedFiles++;
                        report.fileDetails.push({ filePath, status: "ok", changes: changesList });
                    } else {
                        report.failedFiles++;
                        report.errors.push(`${filePath}: ${result.error}`);
                        report.fileDetails.push({ filePath, status: "failed", changes: [], error: result.error });
                    }
                } else {
                    report.processedFiles++;
                    report.fileDetails.push({ filePath, status: "dry-run", changes: changesList });
                }
            } catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                report.failedFiles++;
                report.errors.push(`${filePath}: ${message}`);
                report.fileDetails.push({ filePath, status: "error", changes: [], error: message });
            }
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        report.errors.push(`Directory scan failed: ${message}`);
    }

    report.endTime = Date.now();
    report.durationMs = report.endTime - report.startTime;
    return report;
}

/**
 * Sinh báo cáo text.
 * @param {import("./models.js").DocumentationReport} report
 * @returns {string}
 */
export function formatReport(report: DocumentationReport): string {
    const lines = [
        "═══════════════════════════════════════════════════════",
        "  📝 BÁO CÁO DOCUMENTATION SYSTEM",
        "═══════════════════════════════════════════════════════",
        "",
        `  📁 Tổng files:       ${report.totalFiles}`,
        `  ✅ Đã xử lý:        ${report.processedFiles}`,
        `  ⏭️  Bỏ qua:          ${report.skippedFiles}`,
        `  ❌ Lỗi:             ${report.failedFiles}`,
        "",
        `  📊 Tổng hàm:        ${report.totalFunctions}`,
        `  📝 Đã có doc:       ${report.documentedFunctions}`,
        `  ❗ Thiếu doc:       ${report.undocumentedFunctions}`,
        "",
        `  📄 Headers thêm:    ${report.headersAdded}`,
        `  💬 Inline comments: ${report.inlineCommentsAdded}`,
        `  📦 Block comments:  ${report.blockCommentsAdded}`,
        "",
        `  ⏱️  Thời gian:       ${report.durationMs}ms`,
        "═══════════════════════════════════════════════════════"
    ];

    if (report.errors.length > 0) {
        lines.push("", "  Lỗi chi tiết:");
        report.errors.forEach(e => lines.push(`  ⚠️  ${e}`));
    }

    return lines.join("\n");
}
