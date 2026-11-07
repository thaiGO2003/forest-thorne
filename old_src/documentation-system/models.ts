/**
 * @file models.js — Data models cho Documentation System.
 *
 * Định nghĩa cấu trúc dữ liệu cho kết quả phân tích, thông tin hàm,
 * tham số, code blocks, comments, và validation results.
 */

// ── Type aliases ─────────────────────────────────────────────────────────────

export type CommentLanguage = "vi" | "en" | null;

export type FunctionType = "function" | "arrow" | "method" | "async" | "generator";

export type CommentType = "line" | "block" | "jsdoc";

export type CodeBlockType = "loop" | "conditional" | "switch" | "try" | "block";

// ── Parameter ────────────────────────────────────────────────────────────────

export interface Parameter {
    name: string;
    type: string;
    defaultValue: string | null;
    isOptional: boolean;
    isRest: boolean;
    isDestructured: boolean;
    properties: string[];
}

export interface ParameterOpts {
    name?: string;
    type?: string;
    defaultValue?: string | null;
    isOptional?: boolean;
    isRest?: boolean;
    isDestructured?: boolean;
    properties?: string[];
}

/**
 * Tạo Parameter — thông tin tham số.
 */
export function createParameter(opts: ParameterOpts = {}): Parameter {
    return {
        name: opts.name ?? "",
        type: opts.type ?? "*",
        defaultValue: opts.defaultValue ?? null,
        isOptional: opts.isOptional ?? false,
        isRest: opts.isRest ?? false,
        isDestructured: opts.isDestructured ?? false,
        properties: opts.properties ?? []      // cho destructured params
    };
}

// ── FunctionInfo ─────────────────────────────────────────────────────────────

export interface FunctionInfo {
    name: string;
    type: FunctionType;
    line: number;
    endLine: number;
    column: number;
    params: Parameter[];
    returnType: string | null;
    hasReturn: boolean;
    throwsExceptions: string[];
    isExported: boolean;
    isAsync: boolean;
    isGenerator: boolean;
    hasJSDoc: boolean;
    existingJSDoc: string | null;
    complexity: number;
    nestingDepth: number;
    body: unknown | null;
}

export interface FunctionInfoOpts {
    name?: string;
    type?: FunctionType;
    line?: number;
    endLine?: number;
    column?: number;
    params?: Parameter[];
    returnType?: string | null;
    body?: unknown | null;
    hasReturn?: boolean;
    throwsExceptions?: string[];
    isExported?: boolean;
    isAsync?: boolean;
    isGenerator?: boolean;
    hasJSDoc?: boolean;
    existingJSDoc?: string | null;
    complexity?: number;
    nestingDepth?: number;
}

/**
 * Tạo FunctionInfo — thông tin về một function.
 */
export function createFunctionInfo(opts: FunctionInfoOpts = {}): FunctionInfo {
    return {
        name: opts.name ?? "anonymous",
        type: opts.type ?? "function",
        line: opts.line ?? 0,
        endLine: opts.endLine ?? 0,
        column: opts.column ?? 0,
        params: opts.params ?? [],
        returnType: opts.returnType ?? null,
        hasReturn: opts.hasReturn ?? false,
        throwsExceptions: opts.throwsExceptions ?? [],
        isExported: opts.isExported ?? false,
        isAsync: opts.isAsync ?? false,
        isGenerator: opts.isGenerator ?? false,
        hasJSDoc: opts.hasJSDoc ?? false,
        existingJSDoc: opts.existingJSDoc ?? null,
        complexity: opts.complexity ?? 1,
        nestingDepth: opts.nestingDepth ?? 0,
        body: opts.body ?? null
    };
}

// ── ClassInfo ────────────────────────────────────────────────────────────────

export interface ClassInfo {
    name: string;
    line: number;
    endLine: number;
    isExported: boolean;
    hasJSDoc: boolean;
    existingJSDoc: string | null;
    methods: FunctionInfo[];
}

export interface ClassInfoOpts {
    name?: string;
    line?: number;
    endLine?: number;
    isExported?: boolean;
    hasJSDoc?: boolean;
    existingJSDoc?: string | null;
    methods?: FunctionInfo[];
}

export function createClassInfo(opts: ClassInfoOpts = {}): ClassInfo {
    return {
        name: opts.name ?? "anonymous",
        line: opts.line ?? 0,
        endLine: opts.endLine ?? 0,
        isExported: opts.isExported ?? false,
        hasJSDoc: opts.hasJSDoc ?? false,
        existingJSDoc: opts.existingJSDoc ?? null,
        methods: opts.methods ?? []
    };
}

// ── CodeBlock ────────────────────────────────────────────────────────────────

export interface CodeBlock {
    startLine: number;
    endLine: number;
    complexity: number;
    nestingDepth: number;
    type: CodeBlockType;
    hasComment: boolean;
    code: string;
}

export interface CodeBlockOpts {
    startLine?: number;
    endLine?: number;
    complexity?: number;
    nestingDepth?: number;
    type?: CodeBlockType;
    hasComment?: boolean;
    code?: string;
}

/**
 * Tạo CodeBlock — đoạn code phức tạp cần comment.
 */
export function createCodeBlock(opts: CodeBlockOpts = {}): CodeBlock {
    return {
        startLine: opts.startLine ?? 0,
        endLine: opts.endLine ?? 0,
        complexity: opts.complexity ?? 1,
        nestingDepth: opts.nestingDepth ?? 0,
        type: opts.type ?? "block",
        hasComment: opts.hasComment ?? false,
        code: opts.code ?? ""
    };
}

// ── Comment ──────────────────────────────────────────────────────────────────

export interface Comment {
    line: number;
    endLine: number;
    type: CommentType;
    value: string;
    language: CommentLanguage;
}

export interface CommentOpts {
    line?: number;
    endLine?: number;
    type?: CommentType;
    value?: string;
    language?: CommentLanguage;
}

/**
 * Tạo Comment — thông tin comment hiện có.
 */
export function createComment(opts: CommentOpts = {}): Comment {
    return {
        line: opts.line ?? 0,
        endLine: opts.endLine ?? 0,
        type: opts.type ?? "line",
        value: opts.value ?? "",
        language: opts.language ?? null
    };
}

// ── AnalysisResult ───────────────────────────────────────────────────────────

export interface AnalysisResult {
    filePath: string;
    hasHeader: boolean;
    headerComment: string | null;
    headerLanguage: CommentLanguage;
    functions: FunctionInfo[];
    classes: ClassInfo[];
    complexBlocks: CodeBlock[];
    existingComments: Comment[];
    imports: string[];
    exports: string[];
    errors: string[];
}

export interface AnalysisResultOpts {
    filePath: string;
}

/**
 * Tạo AnalysisResult — kết quả phân tích một file.
 * @param {string} filePath - Đường dẫn file
 * @returns {AnalysisResult}
 */
export function createAnalysisResult(filePath: string): AnalysisResult {
    return {
        filePath,
        hasHeader: false,
        headerComment: null,
        headerLanguage: null,       // 'vi' | 'en' | null
        functions: [],              // FunctionInfo[]
        classes: [],                // ClassInfo[]
        complexBlocks: [],          // CodeBlock[]
        existingComments: [],       // Comment[]
        imports: [],                // string[]
        exports: [],                // string[]
        errors: []                  // string[]
    };
}

// ── DocumentationChanges ─────────────────────────────────────────────────────

export interface FunctionDocChange {
    line: number;
    jsdoc: string;
}

export interface CommentChange {
    line: number;
    comment: string;
}

export interface DocumentationChanges {
    header: string | null;
    functionDocs: FunctionDocChange[];
    inlineComments: CommentChange[];
    blockComments: CommentChange[];
}

// ── FileDetail ──────────────────────────────────────────────────────────────

export interface FileDetail {
    filePath: string;
    status: "skipped" | "ok" | "failed" | "error" | "dry-run";
    changes: string[];
    error?: string;
}

// ── DocumentationReport ──────────────────────────────────────────────────────

export interface DocumentationReport {
    totalFiles: number;
    processedFiles: number;
    skippedFiles: number;
    failedFiles: number;
    totalFunctions: number;
    documentedFunctions: number;
    undocumentedFunctions: number;
    headersAdded: number;
    inlineCommentsAdded: number;
    blockCommentsAdded: number;
    translatedComments: number;
    fileDetails: FileDetail[];
    errors: string[];
    startTime: number;
    endTime: number | null;
    durationMs: number;
}

export interface DocumentationReportOpts {
    totalFiles?: number;
    processedFiles?: number;
    skippedFiles?: number;
    failedFiles?: number;
    totalFunctions?: number;
    documentedFunctions?: number;
    undocumentedFunctions?: number;
    headersAdded?: number;
    inlineCommentsAdded?: number;
    blockCommentsAdded?: number;
    translatedComments?: number;
    fileDetails?: FileDetail[];
    errors?: string[];
    startTime?: number;
    endTime?: number | null;
    durationMs?: number;
}

/**
 * Tạo DocumentationReport — báo cáo tổng hợp.
 */
export function createDocumentationReport(opts: DocumentationReportOpts = {}): DocumentationReport {
    return {
        totalFiles: opts.totalFiles ?? 0,
        processedFiles: opts.processedFiles ?? 0,
        skippedFiles: opts.skippedFiles ?? 0,
        failedFiles: opts.failedFiles ?? 0,
        totalFunctions: opts.totalFunctions ?? 0,
        documentedFunctions: opts.documentedFunctions ?? 0,
        undocumentedFunctions: opts.undocumentedFunctions ?? 0,
        headersAdded: opts.headersAdded ?? 0,
        inlineCommentsAdded: opts.inlineCommentsAdded ?? 0,
        blockCommentsAdded: opts.blockCommentsAdded ?? 0,
        translatedComments: opts.translatedComments ?? 0,
        fileDetails: opts.fileDetails ?? [],
        errors: opts.errors ?? [],
        startTime: opts.startTime ?? Date.now(),
        endTime: opts.endTime ?? null,
        durationMs: opts.durationMs ?? 0
    };
}

// ── WriteDocumentationResult ─────────────────────────────────────────────────

export interface WriteDocumentationResult {
    success: boolean;
    error?: string;
    changesCount: number;
}
