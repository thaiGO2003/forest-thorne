/**
 * @file DocumentationWriter.js — Ghi documentation vào source files.
 *
 * Chèn headers, JSDoc, inline/block comments vào đúng vị trí trong file.
 * Có backup trước khi ghi và rollback khi lỗi.
 */

import { readFile, writeFile, copyFile, unlink } from "fs/promises";
import type { DocumentationChanges, WriteDocumentationResult } from "./models.js";

/**
 * Tạo backup file trước khi sửa đổi.
 * @param {string} filePath
 * @returns {Promise<string>} Đường dẫn backup
 */
export async function createBackup(filePath: string): Promise<string> {
    const backupPath = filePath + ".bak";
    await copyFile(filePath, backupPath);
    return backupPath;
}

/**
 * Khôi phục file từ backup.
 * @param {string} filePath
 * @param {string} backupPath
 */
export async function restoreBackup(filePath: string, backupPath: string): Promise<void> {
    await copyFile(backupPath, filePath);
    await unlink(backupPath);
}

/**
 * Xóa backup file.
 * @param {string} backupPath
 */
export async function removeBackup(backupPath: string): Promise<void> {
    try {
        await unlink(backupPath);
    } catch (_err) { /* bỏ qua nếu không tồn tại */ }
}

/**
 * Chèn file header vào đầu file (trước imports).
 * @param {string} source - Nội dung file gốc
 * @param {string} header - JSDoc header string
 * @returns {string} Nội dung mới
 */
export function insertFileHeader(source: string, header: string): string {
    const lines = source.split("\n");

    // Kiểm tra đã có header chưa
    const firstNonEmpty = lines.findIndex(l => l.trim().length > 0);
    if (firstNonEmpty >= 0 && lines[firstNonEmpty].trim().startsWith("/**")) {
        // Đã có header — skip
        return source;
    }

    return header + "\n\n" + source;
}

/**
 * Chèn JSDoc comment trước function declaration.
 * @param {string} source - Nội dung file
 * @param {number} line - Line number (1-indexed) của function
 * @param {string} jsdoc - JSDoc block string
 * @returns {string} Nội dung mới
 */
export function insertFunctionDoc(source: string, line: number, jsdoc: string): string {
    const lines = source.split("\n");
    const idx = line - 1; // 0-indexed

    if (idx < 0 || idx >= lines.length) return source;

    // Kiểm tra đã có JSDoc ở line trước chưa
    if (idx > 0) {
        const prevLine = lines[idx - 1].trim();
        if (prevLine.endsWith("*/")) {
            return source; // Đã có JSDoc
        }
    }

    // Detect indentation
    const indent = lines[idx].match(/^(\s*)/)?.[1] ?? "";
    const indentedDoc = jsdoc.split("\n").map(l => indent + l).join("\n");

    lines.splice(idx, 0, indentedDoc);
    return lines.join("\n");
}

/**
 * Chèn inline comment (// ...) phía trên một dòng code.
 * @param {string} source - Nội dung file
 * @param {number} line - Line number (1-indexed)
 * @param {string} comment - Comment text (without //)
 * @returns {string}
 */
export function insertInlineComment(source: string, line: number, comment: string): string {
    const lines = source.split("\n");
    const idx = line - 1;

    if (idx < 0 || idx >= lines.length) return source;

    // Kiểm tra dòng trước đã có comment chưa
    if (idx > 0) {
        const prevLine = lines[idx - 1].trim();
        if (prevLine.startsWith("//") || prevLine.startsWith("/*")) {
            return source; // Đã có comment
        }
    }

    const indent = lines[idx].match(/^(\s*)/)?.[1] ?? "";

    // Cắt ngắn comment nếu quá dài (< 120 chars tổng cộng)
    const maxLen = 120 - indent.length - 3; // "// " = 3 chars
    const truncated = comment.length > maxLen ? comment.substring(0, maxLen - 3) + "..." : comment;

    lines.splice(idx, 0, `${indent}// ${truncated}`);
    return lines.join("\n");
}

/**
 * Chèn block comment (/* ... *\/) phía trên một dòng code.
 * @param {string} source - Nội dung file
 * @param {number} line - Line number (1-indexed)
 * @param {string} blockComment - Block comment string
 * @returns {string}
 */
export function insertBlockComment(source: string, line: number, blockComment: string): string {
    const lines = source.split("\n");
    const idx = line - 1;

    if (idx < 0 || idx >= lines.length) return source;

    // Kiểm tra đã có comment trước dòng này chưa
    if (idx > 0) {
        const prevLine = lines[idx - 1].trim();
        if (prevLine.startsWith("//") || prevLine.startsWith("/*") || prevLine.endsWith("*/")) {
            return source;
        }
    }

    const indent = lines[idx].match(/^(\s*)/)?.[1] ?? "";
    const indented = blockComment.split("\n").map(l => indent + l).join("\n");

    lines.splice(idx, 0, indented);
    return lines.join("\n");
}

export interface JSDocValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Validate JSDoc format.
 * @param {string} jsdoc
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateJSDoc(jsdoc: string): JSDocValidationResult {
    const errors: string[] = [];

    if (!jsdoc.includes("/**")) errors.push("Thiếu /** mở đầu");
    if (!jsdoc.includes("*/")) errors.push("Thiếu */ kết thúc");

    // Check @param format
    const paramLines = jsdoc.match(/@param\s+.*/g) ?? [];
    for (const line of paramLines) {
        if (!/@param\s+\{[^}]+\}/.test(line)) {
            errors.push(`@param thiếu type: ${line.trim()}`);
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Apply tất cả documentation changes vào file.
 * Xử lý theo thứ tự ngược (bottom-up) để line numbers không bị lệch.
 *
 * @param {string} source - Nội dung file gốc
 * @param {DocumentationChanges} changes - Các thay đổi cần làm
 * @returns {string} Nội dung mới
 */
export function applyAllChanges(source: string, changes: DocumentationChanges): string {
    let result = source;

    // Sort all insertions by line descending (bottom-up)
    interface Insertion {
        line: number;
        type: "jsdoc" | "inline" | "block";
        content: string;
    }
    const insertions: Insertion[] = [];

    if (changes.functionDocs) {
        for (const { line, jsdoc } of changes.functionDocs) {
            insertions.push({ line, type: "jsdoc", content: jsdoc });
        }
    }
    if (changes.inlineComments) {
        for (const { line, comment } of changes.inlineComments) {
            insertions.push({ line, type: "inline", content: comment });
        }
    }
    if (changes.blockComments) {
        for (const { line, comment } of changes.blockComments) {
            insertions.push({ line, type: "block", content: comment });
        }
    }

    // Sort descending by line number
    insertions.sort((a, b) => b.line - a.line);

    // Apply bottom-up
    for (const ins of insertions) {
        switch (ins.type) {
            case "jsdoc":
                result = insertFunctionDoc(result, ins.line, ins.content);
                break;
            case "inline":
                result = insertInlineComment(result, ins.line, ins.content);
                break;
            case "block":
                result = insertBlockComment(result, ins.line, ins.content);
                break;
        }
    }

    // Header goes last (at top)
    if (changes.header) {
        result = insertFileHeader(result, changes.header);
    }

    return result;
}

/**
 * Ghi documentation vào file thực tế (với backup + rollback).
 * @param {string} filePath - Đường dẫn file
 * @param {DocumentationChanges} changes - Các thay đổi
 * @returns {Promise<WriteDocumentationResult>}
 */
export async function writeDocumentation(filePath: string, changes: DocumentationChanges): Promise<WriteDocumentationResult> {
    let backupPath: string | null = null;
    try {
        // 1. Đọc file
        const source = await readFile(filePath, "utf-8");

        // 2. Backup
        backupPath = await createBackup(filePath);

        // 3. Apply changes
        const newSource = applyAllChanges(source, changes);
        const changesCount = (changes.header ? 1 : 0)
            + (changes.functionDocs?.length ?? 0)
            + (changes.inlineComments?.length ?? 0)
            + (changes.blockComments?.length ?? 0);

        if (newSource === source) {
            await removeBackup(backupPath);
            return { success: true, changesCount: 0 };
        }

        // 4. Ghi file
        await writeFile(filePath, newSource, "utf-8");

        // 5. Xóa backup
        await removeBackup(backupPath);

        return { success: true, changesCount };
    } catch (err) {
        // Rollback
        if (backupPath) {
            try { await restoreBackup(filePath, backupPath); } catch (_e) { /* ignore */ }
        }
        const message = err instanceof Error ? err.message : String(err);
        return { success: false, error: message, changesCount: 0 };
    }
}
