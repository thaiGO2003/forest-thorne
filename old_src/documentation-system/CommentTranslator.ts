/**
 * @file CommentTranslator.js — Phát hiện và dịch comments English → Vietnamese.
 *
 * Sử dụng từ điển tĩnh cho các thuật ngữ lập trình phổ biến.
 * Giữ nguyên technical terms, JSDoc tags, code examples, URLs.
 */

// ── Từ điển EN → VI cho các cụm từ phổ biến ─────────────────────────────
const TRANSLATION_DICT: Record<string, string> = {
    // Verbs
    "returns": "trả về",
    "returns the": "trả về",
    "creates": "tạo",
    "creates a": "tạo một",
    "creates an": "tạo một",
    "initializes": "khởi tạo",
    "handles": "xử lý",
    "processes": "xử lý",
    "validates": "kiểm tra tính hợp lệ",
    "checks": "kiểm tra",
    "checks if": "kiểm tra xem",
    "checks whether": "kiểm tra xem",
    "computes": "tính toán",
    "calculates": "tính toán",
    "parses": "phân tích",
    "extracts": "trích xuất",
    "generates": "sinh ra",
    "renders": "hiển thị",
    "updates": "cập nhật",
    "removes": "xóa",
    "deletes": "xóa",
    "adds": "thêm",
    "gets": "lấy",
    "sets": "đặt",
    "finds": "tìm",
    "searches": "tìm kiếm",
    "sorts": "sắp xếp",
    "filters": "lọc",
    "transforms": "chuyển đổi",
    "converts": "chuyển đổi",
    "loads": "tải",
    "saves": "lưu",
    "stores": "lưu trữ",
    "fetches": "lấy",
    "sends": "gửi",
    "receives": "nhận",
    "emits": "phát sự kiện",
    "dispatches": "gửi đi",
    "triggers": "kích hoạt",
    "applies": "áp dụng",
    "resets": "đặt lại",
    "clears": "xóa sạch",
    "destroys": "hủy",
    "disposes": "giải phóng",
    "connects": "kết nối",
    "disconnects": "ngắt kết nối",
    "subscribes": "đăng ký",
    "unsubscribes": "hủy đăng ký",
    "registers": "đăng ký",
    "unregisters": "hủy đăng ký",
    "toggles": "bật/tắt",
    "enables": "bật",
    "disables": "tắt",

    // Nouns / phrases
    "the result": "kết quả",
    "the value": "giá trị",
    "the data": "dữ liệu",
    "the list": "danh sách",
    "the array": "mảng",
    "the object": "đối tượng",
    "the string": "chuỗi",
    "the number": "số",
    "the index": "chỉ số",
    "the item": "phần tử",
    "the element": "phần tử",
    "the key": "khóa",
    "the error": "lỗi",
    "the callback": "callback",
    "the event": "sự kiện",
    "the handler": "handler",
    "the listener": "listener",
    "the state": "trạng thái",
    "the config": "cấu hình",
    "the options": "tùy chọn",
    "the settings": "cài đặt",
    "the response": "phản hồi",
    "the request": "yêu cầu",
    "the path": "đường dẫn",
    "the file": "tệp",
    "the directory": "thư mục",
    "the name": "tên",
    "the type": "kiểu",
    "the message": "thông điệp",
    "the text": "văn bản",
    "the label": "nhãn",
    "the title": "tiêu đề",
    "the description": "mô tả",
    "the component": "thành phần",
    "the module": "module",
    "the class": "lớp",
    "the instance": "instance",
    "the property": "thuộc tính",
    "the method": "phương thức",
    "the parameter": "tham số",
    "the argument": "đối số",
    "if true": "nếu true",
    "if false": "nếu false",
    "optional": "tùy chọn",
    "required": "bắt buộc",
    "default": "mặc định",
    "deprecated": "đã lỗi thời",
    "internal": "nội bộ",
    "private": "riêng tư",
    "public": "công khai",
    "static": "tĩnh",
};

// ── Technical terms KHÔNG dịch ──────────────────────────────────────────────
const TECHNICAL_TERMS: Set<string> = new Set([
    "async", "await", "callback", "promise", "observable", "iterator", "generator",
    "prototype", "constructor", "getter", "setter", "proxy", "reflect",
    "module", "import", "export", "require", "default",
    "null", "undefined", "NaN", "Infinity", "void",
    "boolean", "string", "number", "bigint", "symbol", "object", "array",
    "function", "class", "interface", "type", "enum",
    "const", "let", "var", "static", "abstract", "extends", "implements",
    "try", "catch", "finally", "throw", "error",
    "for", "while", "do", "if", "else", "switch", "case", "break", "continue", "return",
    "map", "filter", "reduce", "forEach", "find", "some", "every", "includes",
    "push", "pop", "shift", "unshift", "splice", "slice", "concat",
    "JSON", "XML", "HTML", "CSS", "DOM", "API", "REST", "HTTP", "HTTPS",
    "URL", "URI", "UUID", "GUID", "ID",
    "GET", "POST", "PUT", "DELETE", "PATCH",
    "WebSocket", "EventSource", "fetch",
    "React", "Vue", "Angular", "Node", "Express", "Phaser",
    "parseInt", "parseFloat", "toString", "valueOf",
    "setTimeout", "setInterval", "clearTimeout", "clearInterval",
    "console", "log", "warn", "error", "info", "debug",
    "JSDoc", "@param", "@returns", "@throws", "@type", "@typedef"
]);

/**
 * Phát hiện ngôn ngữ của comment.
 * @param {string} text
 * @returns {"vi" | "en" | "mixed" | null}
 */
export function detectLanguage(text: string): "vi" | "en" | "mixed" | null {
    if (!text || text.trim().length < 3) return null;

    const clean = text.replace(/@\w+/g, "").replace(/[{}()\[\]<>/*]/g, "").trim();
    if (clean.length < 3) return null;

    const viChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    const viWords = /\b(và|cho|của|trong|với|không|này|các|được|đã|từ|những|có|để|khi|bởi|một|là|hoặc|nhưng|cũng|vì|nên|tại|sao|thì|mà)\b/gi;

    const hasVi = viChars.test(clean);
    const viCount = (clean.match(viWords) || []).length;

    if (hasVi || viCount >= 2) return "vi";

    const enWords = /\b(the|and|for|with|this|that|from|are|was|has|have|not|but|will|can|should|would|could|does|been|into|than|then|also|when|which|their)\b/gi;
    const enCount = (clean.match(enWords) || []).length;

    if (enCount >= 2) return "en";
    return null;
}

/**
 * Kiểm tra term có phải technical term không.
 */
export function isTechnicalTerm(term: string): boolean {
    return TECHNICAL_TERMS.has(term) || TECHNICAL_TERMS.has(term.toLowerCase());
}

/**
 * Extract technical terms từ text.
 * @param {string} text
 * @returns {string[]}
 */
export function extractTechnicalTerms(text: string): string[] {
    const words = text.split(/[\s,.;:!?(){}[\]<>"'`]+/);
    return words.filter(w => w.length > 0 && isTechnicalTerm(w));
}

/**
 * Dịch comment English → Vietnamese sử dụng từ điển tĩnh.
 * Giữ nguyên: JSDoc tags, technical terms, code examples, URLs.
 *
 * @param {string} text - Comment text
 * @returns {string} Translated text
 */
export function translateComment(text: string): string {
    if (!text) return text;

    const lang = detectLanguage(text);
    if (lang === "vi") return text; // Đã là tiếng Việt rồi

    let result = text;

    // Preserve JSDoc tags
    const jsdocTags: string[] = [];
    result = result.replace(/@(\w+)\s*\{([^}]*)\}/g, (match) => {
        jsdocTags.push(match);
        return `__JSDOC_${jsdocTags.length - 1}__`;
    });

    // Preserve URLs
    const urls: string[] = [];
    result = result.replace(/https?:\/\/[^\s)]+/g, (match) => {
        urls.push(match);
        return `__URL_${urls.length - 1}__`;
    });

    // Preserve backtick code
    const codes: string[] = [];
    result = result.replace(/`[^`]+`/g, (match) => {
        codes.push(match);
        return `__CODE_${codes.length - 1}__`;
    });

    // Apply dictionary translations (longest match first)
    const sortedKeys = Object.keys(TRANSLATION_DICT).sort((a, b) => b.length - a.length);
    for (const en of sortedKeys) {
        const vi = TRANSLATION_DICT[en];
        const regex = new RegExp(`\\b${escapeRegex(en)}\\b`, "gi");
        result = result.replace(regex, vi);
    }

    // Restore preserved tokens
    result = result.replace(/__JSDOC_(\d+)__/g, (_, i) => jsdocTags[i]);
    result = result.replace(/__URL_(\d+)__/g, (_, i) => urls[i]);
    result = result.replace(/__CODE_(\d+)__/g, (_, i) => codes[i]);

    return result;
}

function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
