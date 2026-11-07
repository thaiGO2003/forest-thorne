/**
 * @file DocumentationGenerator.js — Tạo nội dung documentation tiếng Việt.
 *
 * Nhận AnalysisResult từ CodeAnalyzer, sinh ra comments/JSDoc tiếng Việt
 * cho headers, functions, complex blocks.
 */

import type { AnalysisResult, FunctionInfo, CodeBlock } from "./models.js";

// ── Vietnamese description templates ─────────────────────────────────────
const EFFECT_VERBS: Record<string, string> = {
    function: "Xử lý",
    arrow: "Xử lý",
    method: "Phương thức",
    async: "Xử lý bất đồng bộ",
    generator: "Generator sinh"
};

const TYPE_MAP: Record<string, string> = {
    "string": "chuỗi",
    "number": "số",
    "boolean": "boolean",
    "object": "đối tượng",
    "array": "mảng",
    "function": "hàm",
    "null": "null",
    "undefined": "undefined",
    "Promise": "Promise"
};

/**
 * Sinh file header JSDoc tiếng Việt.
 * @param {AnalysisResult} analysis
 * @returns {string} JSDoc header string
 */
export function generateFileHeader(analysis: AnalysisResult): string {
    const name = extractFileName(analysis.filePath);
    const exports = analysis.exports.length
        ? analysis.exports.slice(0, 5).join(", ")
        : "internal";

    const lines: string[] = [
        `/**`,
        ` * @file ${name}`,
        ` *`
    ];

    // Mô tả based on exports
    if (analysis.exports.length > 0) {
        lines.push(` * Exports: ${exports}${analysis.exports.length > 5 ? ` (và ${analysis.exports.length - 5} khác)` : ""}`);
    }

    if (analysis.functions.length > 0) {
        lines.push(` * Chứa ${analysis.functions.length} hàm${analysis.classes.length > 0 ? ` và ${analysis.classes.length} lớp` : ""}.`);
    }

    if (analysis.imports.length > 0) {
        lines.push(` * Phụ thuộc: ${analysis.imports.slice(0, 3).join(", ")}${analysis.imports.length > 3 ? "..." : ""}`);
    }

    lines.push(` */`);
    return lines.join("\n");
}

/**
 * Sinh JSDoc cho một function.
 * @param {FunctionInfo} fn
 * @returns {string} JSDoc block
 */
export function generateFunctionDoc(fn: FunctionInfo): string {
    const lines: string[] = [`/**`];

    // Description
    const verb = EFFECT_VERBS[fn.type] ?? "Xử lý";
    const desc = generateFunctionDescription(fn);
    lines.push(` * ${desc}`);

    // Params
    if (fn.params.length > 0) {
        for (const param of fn.params) {
            const typeStr = param.type !== "*" ? param.type : inferParamType(param);
            const optTag = param.isOptional ? " (tùy chọn)" : "";
            const restTag = param.isRest ? "..." : "";
            const defTag = param.defaultValue ? ` - Mặc định: ${param.defaultValue}` : "";
            lines.push(` * @param {${typeStr}} ${restTag}${param.name}${optTag}${defTag}`);
        }
    }

    // Returns
    if (fn.hasReturn) {
        const retType = fn.isAsync ? "Promise<*>" : "*";
        lines.push(` * @returns {${retType}}`);
    }

    // Throws
    for (const ex of fn.throwsExceptions) {
        lines.push(` * @throws {${ex}}`);
    }

    lines.push(` */`);
    return lines.join("\n");
}

/**
 * Sinh mô tả hàm tiếng Việt dựa trên tên và signature.
 */
function generateFunctionDescription(fn: FunctionInfo): string {
    const name = fn.name;

    // Common naming patterns → Vietnamese descriptions
    if (name.startsWith("get") || name.startsWith("fetch")) {
        const subject = camelToVietnamese(name.replace(/^(get|fetch)/, ""));
        return `Lấy ${subject}.`;
    }
    if (name.startsWith("set") || name.startsWith("update")) {
        const subject = camelToVietnamese(name.replace(/^(set|update)/, ""));
        return `Cập nhật ${subject}.`;
    }
    if (name.startsWith("create") || name.startsWith("make") || name.startsWith("build")) {
        const subject = camelToVietnamese(name.replace(/^(create|make|build)/, ""));
        return `Tạo ${subject}.`;
    }
    if (name.startsWith("delete") || name.startsWith("remove") || name.startsWith("destroy")) {
        const subject = camelToVietnamese(name.replace(/^(delete|remove|destroy)/, ""));
        return `Xóa ${subject}.`;
    }
    if (name.startsWith("is") || name.startsWith("has") || name.startsWith("can")) {
        const subject = camelToVietnamese(name.replace(/^(is|has|can)/, ""));
        return `Kiểm tra ${subject}.`;
    }
    if (name.startsWith("handle") || name.startsWith("on")) {
        const subject = camelToVietnamese(name.replace(/^(handle|on)/, ""));
        return `Xử lý sự kiện ${subject}.`;
    }
    if (name.startsWith("init") || name.startsWith("setup")) {
        const subject = camelToVietnamese(name.replace(/^(init|setup)/, ""));
        return `Khởi tạo ${subject}.`;
    }
    if (name.startsWith("render") || name.startsWith("draw") || name.startsWith("display")) {
        const subject = camelToVietnamese(name.replace(/^(render|draw|display)/, ""));
        return `Hiển thị ${subject}.`;
    }
    if (name.startsWith("parse") || name.startsWith("extract")) {
        const subject = camelToVietnamese(name.replace(/^(parse|extract)/, ""));
        return `Phân tích ${subject}.`;
    }
    if (name.startsWith("validate") || name.startsWith("check")) {
        const subject = camelToVietnamese(name.replace(/^(validate|check)/, ""));
        return `Kiểm tra tính hợp lệ ${subject}.`;
    }
    if (name.startsWith("calculate") || name.startsWith("compute")) {
        const subject = camelToVietnamese(name.replace(/^(calculate|compute)/, ""));
        return `Tính toán ${subject}.`;
    }
    if (name.startsWith("find") || name.startsWith("search")) {
        const subject = camelToVietnamese(name.replace(/^(find|search)/, ""));
        return `Tìm kiếm ${subject}.`;
    }
    if (name.startsWith("sort") || name.startsWith("order")) {
        const subject = camelToVietnamese(name.replace(/^(sort|order)/, ""));
        return `Sắp xếp ${subject}.`;
    }
    if (name.startsWith("filter")) {
        const subject = camelToVietnamese(name.replace(/^filter/, ""));
        return `Lọc ${subject}.`;
    }
    if (name.startsWith("transform") || name.startsWith("convert")) {
        const subject = camelToVietnamese(name.replace(/^(transform|convert)/, ""));
        return `Chuyển đổi ${subject}.`;
    }
    if (name.startsWith("load")) {
        const subject = camelToVietnamese(name.replace(/^load/, ""));
        return `Tải ${subject}.`;
    }
    if (name.startsWith("save") || name.startsWith("store") || name.startsWith("persist")) {
        const subject = camelToVietnamese(name.replace(/^(save|store|persist)/, ""));
        return `Lưu ${subject}.`;
    }
    if (name.startsWith("refresh") || name.startsWith("reload")) {
        const subject = camelToVietnamese(name.replace(/^(refresh|reload)/, ""));
        return `Làm mới ${subject}.`;
    }
    if (name === "constructor") {
        return `Khởi tạo instance.`;
    }

    // Generic
    const verb = EFFECT_VERBS[fn.type] ?? "Xử lý";
    return `${verb} ${camelToVietnamese(name)}.`;
}

/**
 * Sinh inline comment tiếng Việt cho code block phức tạp.
 * @param {CodeBlock} block
 * @returns {string} Comment text (without // prefix)
 */
export function generateInlineComment(block: CodeBlock): string {
    switch (block.type) {
        case "loop":
            return `Lặp qua các phần tử (complexity: ${block.complexity})`;
        case "conditional":
            return `Logic điều kiện phức tạp (${block.complexity} nhánh)`;
        case "switch":
            return `Xử lý nhiều trường hợp`;
        case "try":
            return `Xử lý lỗi có thể xảy ra`;
        default:
            return `Logic phức tạp (complexity: ${block.complexity})`;
    }
}

/**
 * Sinh block comment tiếng Việt cho thuật toán phức tạp.
 * @param {CodeBlock} block
 * @param {string} [code] - Source code
 * @returns {string} Block comment
 */
export function generateBlockComment(block: CodeBlock, code: string = ""): string {
    const lines: string[] = [`/*`];

    switch (block.type) {
        case "loop":
            lines.push(` * Vòng lặp xử lý danh sách phần tử.`);
            if (block.nestingDepth >= 2) {
                lines.push(` * Lưu ý: Vòng lặp lồng nhau (${block.nestingDepth} tầng) — cần tối ưu nếu dữ liệu lớn.`);
            }
            break;
        case "conditional":
            lines.push(` * Logic điều kiện phức tạp với ${block.complexity} nhánh.`);
            lines.push(` * Kiểm tra từng điều kiện theo thứ tự ưu tiên.`);
            break;
        case "switch":
            lines.push(` * Xử lý nhiều trường hợp (switch/case).`);
            lines.push(` * Mỗi case xử lý một loại khác nhau.`);
            break;
        case "try":
            lines.push(` * Khối try-catch — Xử lý ngoại lệ.`);
            lines.push(` * Đảm bảo logic không bị crash khi gặp lỗi.`);
            break;
        default:
            lines.push(` * Khối code phức tạp (complexity: ${block.complexity}).`);
    }

    lines.push(` */`);
    return lines.join("\n");
}

// ── Helpers ──────────────────────────────────────────────────────────────

function extractFileName(filePath: string): string {
    return filePath.split(/[/\\]/).pop() ?? filePath;
}

/**
 * Chuyển camelCase thành chuỗi dễ đọc.
 */
function camelToVietnamese(name: string): string {
    if (!name) return "";
    return name
        .replace(/([A-Z])/g, " $1")
        .replace(/[_-]/g, " ")
        .trim()
        .toLowerCase();
}

/**
 * Suy luận kiểu tham số từ tên và default value.
 */
function inferParamType(param: { isRest: boolean; isDestructured: boolean; defaultValue: string | null; name: string }): string {
    if (param.isRest) return "...*";
    if (param.isDestructured) return "Object";
    if (param.defaultValue === "{}") return "Object";
    if (param.defaultValue === "[]") return "Array";
    if (param.defaultValue === "true" || param.defaultValue === "false") return "boolean";
    if (param.defaultValue === "null") return "*";
    if (param.defaultValue && !isNaN(Number(param.defaultValue))) return "number";
    if (param.defaultValue?.startsWith('"')) return "string";

    // Infer from name
    const name = param.name.toLowerCase();
    if (name.includes("callback") || name.includes("fn") || name.includes("handler")) return "Function";
    if (name.includes("count") || name.includes("index") || name.includes("num") || name.includes("size") || name.includes("length")) return "number";
    if (name.includes("name") || name.includes("text") || name.includes("label") || name.includes("title") || name.includes("message") || name.includes("path") || name.includes("url")) return "string";
    if (name.includes("is") || name.includes("has") || name.includes("can") || name.includes("should") || name.includes("enabled") || name.includes("visible")) return "boolean";
    if (name.includes("items") || name.includes("list") || name.includes("array") || name.includes("entries")) return "Array";
    if (name.includes("options") || name.includes("config") || name.includes("opts") || name.includes("settings")) return "Object";
    if (name.includes("element") || name.includes("node") || name.includes("el")) return "HTMLElement";

    return "*";
}