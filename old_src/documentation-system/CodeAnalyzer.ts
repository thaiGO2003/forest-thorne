/**
 * @file CodeAnalyzer.js — Phân tích JavaScript files để extract documentation info.
 *
 * Sử dụng @babel/parser để parse AST, traverse để extract functions,
 * classes, comments, complexity, và header info.
 */

import { parse } from "@babel/parser";
import _traverse, { NodePath } from "@babel/traverse";
import { readdir } from "fs/promises";
import { join, extname } from "path";
import type {
    Node,
    Comment as BabelComment,
    Expression,
    Identifier,
    Pattern,
    StringLiteral,
    NumericLiteral,
    BooleanLiteral,
    NullLiteral,
    ObjectExpression,
    ArrayExpression,
    FunctionDeclaration,
    VariableDeclarator,
    ClassDeclaration,
    ClassMethod,
    BlockStatement
} from "@babel/types";
import {
    createAnalysisResult,
    createClassInfo,
    createFunctionInfo,
    createParameter,
    createCodeBlock,
    createComment,
    type AnalysisResult,
    type Parameter,
    type FunctionInfo,
    type ClassInfo,
    type CodeBlock,
    type CommentLanguage
} from "./models.js";

// Handle both ESM default and CJS interop
const traverse = _traverse.default ?? _traverse;

// ── Local AST helper types ───────────────────────────────────────────────────

/** Subset of @babel/types Comment with required loc for our analyzer. */
type LocatedComment = BabelComment & {
    loc: NonNullable<BabelComment["loc"]>;
};

/** Node with a guaranteed loc property. */
type LocatedNode = Node & {
    loc: NonNullable<Node["loc"]>;
};

/** Shape of a destructured parameter property in our extractor. */
interface ObjectPatternProp {
    key?: { name?: string; value?: string } | null;
}

/**
 * Generic node shape for nesting depth calculation.
 * Covers blocks, statements, expressions that may have nested children.
 */
interface NestableNode {
    type: string;
    body?: NestableNode[] | { body?: NestableNode[] | NestableNode; cases?: SwitchCaseLike[] } | NestableNode | null;
    consequent?: NestableNode | null;
    alternate?: NestableNode | null;
    handler?: { body: NestableNode[] } | null;
    cases?: SwitchCaseLike[] | null;
}

interface SwitchCaseLike {
    consequent?: NestableNode[];
}

// ── analyzeSource ────────────────────────────────────────────────────────────

/**
 * Phân tích một file JavaScript và trả về AnalysisResult.
 * @param {string} source - Nội dung source code
 * @param {string} filePath - Đường dẫn file (dùng cho report)
 * @returns {AnalysisResult}
 */
export function analyzeSource(source: string, filePath: string = "<unknown>"): AnalysisResult {
    const result = createAnalysisResult(filePath);

    let ast: ReturnType<typeof parse>;
    try {
        ast = parse(source, {
            sourceType: "module",
            plugins: ["jsx", "classProperties", "asyncGenerators", "dynamicImport", "optionalChaining", "nullishCoalescingOperator"],
            errorRecovery: true,
            ranges: true
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Parse error: ${message}`);
        return result;
    }

    // ── Extract comments ─────────────────────────────────────────────
    const comments = (ast.comments ?? []) as LocatedComment[];
    for (const c of comments) {
        const isJSDoc = c.type === "CommentBlock" && c.value.startsWith("*");
        const isBlock = c.type === "CommentBlock";
        const commentType: "jsdoc" | "block" | "line" = isJSDoc
            ? "jsdoc"
            : isBlock
                ? "block"
                : "line";
        result.existingComments.push(
            createComment({
                line: c.loc.start.line,
                endLine: c.loc.end.line,
                type: commentType,
                value: c.value.trim(),
                language: detectCommentLanguage(c.value)
            })
        );
    }

    // ── Detect file header ───────────────────────────────────────────
    detectHeader(result, comments, source);

    // ── Traverse AST ─────────────────────────────────────────────────
    const lines = source.split("\n");

    traverse(ast, {
        // ── Imports ──
        ImportDeclaration(path: NodePath) {
            const node = path.node as LocatedNode & { source: { value: string } };
            result.imports.push(node.source.value);
        },

        // ── Exports ──
        ExportNamedDeclaration(path: NodePath) {
            const decl = (path.node as LocatedNode & { declaration?: Node | null }).declaration;
            if (!decl) return;
            const d = decl as Node & {
                id?: { name?: string } | null;
                declarations?: Array<{ id?: { name?: string } | null }>;
            };
            if (decl.type === "FunctionDeclaration" && d.id?.name) {
                result.exports.push(d.id.name);
            } else if (decl.type === "VariableDeclaration" && d.declarations) {
                for (const dec of d.declarations) {
                    if (dec.id?.name) result.exports.push(dec.id.name);
                }
            } else if (decl.type === "ClassDeclaration" && d.id?.name) {
                result.exports.push(d.id.name);
            }
        },
        ExportDefaultDeclaration(path: NodePath) {
            const node = path.node as LocatedNode & {
                declaration: Node & { id?: { name?: string } | null } | null;
            };
            const decl = node.declaration;
            if (decl?.id?.name) {
                result.exports.push(decl.id.name);
            } else {
                result.exports.push("default");
            }
        },

        // ── Functions ──
        FunctionDeclaration(path: NodePath) {
            const fn = extractFunctionInfo(path, comments, lines);
            fn.isExported = isExported(path);
            result.functions.push(fn);
        },

        // ── Arrow functions assigned to variables ──
        VariableDeclarator(path: NodePath) {
            const node = path.node as Node & { init?: Node | null };
            const init = node.init as Expression | null;
            if (init && (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")) {
                const fn = extractArrowInfo(path, init, comments, lines);
                fn.isExported = isExported(path);
                result.functions.push(fn);
            }
        },

        // ── Classes ──
        ClassDeclaration(path: NodePath) {
            const cls = extractClassInfo(path, comments, lines);
            cls.isExported = isExported(path);
            result.classes.push(cls);
        },
    });

    // ── Detect complex blocks ────────────────────────────────────────
    detectComplexBlocks(ast, result, comments, lines);

    return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Phát hiện file header comment (/** ở đầu file).
 */
function detectHeader(result: AnalysisResult, comments: LocatedComment[], _source: string): void {
    if (!comments.length) {
        result.hasHeader = false;
        return;
    }

    const first = comments[0];
    const isTopOfFile = first.loc.start.line <= 3;
    const isBlock = first.type === "CommentBlock";

    if (isTopOfFile && isBlock) {
        result.hasHeader = true;
        result.headerComment = first.value.trim();
        result.headerLanguage = detectCommentLanguage(first.value);
    } else {
        result.hasHeader = false;
    }
}

/**
 * Extract FunctionInfo từ FunctionDeclaration AST node.
 */
function extractFunctionInfo(
    path: NodePath,
    comments: LocatedComment[],
    _lines: string[]
): FunctionInfo {
    const node = path.node as FunctionDeclaration & LocatedNode;
    const jsDoc = findJSDoc(node, comments);

    const body = node.body as BlockStatement | null | undefined;

    return createFunctionInfo({
        name: node.id?.name ?? "anonymous",
        type: node.generator ? "generator" : node.async ? "async" : "function",
        line: node.loc.start.line,
        endLine: node.loc.end.line,
        column: node.loc.start.column,
        params: extractParams(node.params as Node[]),
        hasReturn: bodyHasReturn(body),
        throwsExceptions: findThrows(body),
        isAsync: node.async ?? false,
        isGenerator: node.generator ?? false,
        hasJSDoc: !!jsDoc,
        existingJSDoc: jsDoc?.value ?? null,
        complexity: calculateComplexity(body),
        nestingDepth: calculateNesting(body as unknown as NestableNode | null | undefined)
    });
}

/**
 * Extract FunctionInfo từ arrow/function expression assigned to variable.
 */
function extractArrowInfo(
    varPath: NodePath,
    init: Expression & { type: "ArrowFunctionExpression" | "FunctionExpression" },
    comments: LocatedComment[],
    _lines: string[]
): FunctionInfo {
    const varNode = varPath.node as VariableDeclarator & LocatedNode;
    const parent = varPath.parent as Node | null;
    const jsDoc = findJSDoc(parent as LocatedNode, comments) ?? findJSDoc(varNode, comments);
    const initNode = init as (Expression & LocatedNode) & {
        body: BlockStatement | Expression;
        params: Pattern[];
        async?: boolean;
        generator?: boolean;
    };
    const isBlock = initNode.body.type === "BlockStatement";

    return createFunctionInfo({
        name: varNode.id.type === "Identifier" ? varNode.id.name : "anonymous",
        type: initNode.type === "ArrowFunctionExpression" ? "arrow" : "function",
        line: varNode.loc.start.line,
        endLine: initNode.loc.end.line,
        column: varNode.loc.start.column,
        params: extractParams(initNode.params as Node[]),
        hasReturn: !isBlock ? true : bodyHasReturn(initNode.body as BlockStatement),
        throwsExceptions: isBlock ? findThrows(initNode.body as BlockStatement) : [],
        isAsync: initNode.async ?? false,
        isGenerator: initNode.generator ?? false,
        hasJSDoc: !!jsDoc,
        existingJSDoc: jsDoc?.value ?? null,
        complexity: isBlock ? calculateComplexity(initNode.body as BlockStatement) : 1,
        nestingDepth: isBlock ? calculateNesting(initNode.body as unknown as NestableNode) : 0
    });
}

/**
 * Extract thông tin class.
 */
function extractClassInfo(
    path: NodePath,
    comments: LocatedComment[],
    _lines: string[]
): ClassInfo {
    const node = path.node as ClassDeclaration & LocatedNode & {
        body: { body: ClassMethod[] };
    };
    const jsDoc = findJSDoc(node, comments);
    const methods: FunctionInfo[] = [];

    for (const member of node.body.body) {
        if (member.type === "ClassMethod") {
            const m = member as ClassMethod & LocatedNode;
            const mDoc = findJSDoc(m, comments);
            const key = m.key as (Identifier & { name?: string }) | (StringLiteral & { value: string }) | null;
            const memberName = key && "name" in key ? key.name : (key && "value" in key ? key.value : "unknown");
            methods.push(createFunctionInfo({
                name: memberName ?? "unknown",
                type: "method",
                line: m.loc.start.line,
                endLine: m.loc.end.line,
                params: extractParams(m.params as Node[]),
                hasReturn: bodyHasReturn(m.body as BlockStatement),
                throwsExceptions: findThrows(m.body as BlockStatement),
                isAsync: m.async ?? false,
                isGenerator: m.generator ?? false,
                hasJSDoc: !!mDoc,
                existingJSDoc: mDoc?.value ?? null,
                complexity: calculateComplexity(m.body as BlockStatement),
                nestingDepth: calculateNesting(m.body as unknown as NestableNode)
            }));
        }
    }

    return createClassInfo({
        name: node.id?.name ?? "anonymous",
        line: node.loc.start.line,
        endLine: node.loc.end.line,
        isExported: false,
        hasJSDoc: !!jsDoc,
        existingJSDoc: jsDoc?.value ?? null,
        methods
    });
}

/**
 * Extract parameter info từ AST params.
 */
function extractParams(params: Node[]): Parameter[] {
    return params.map((p): Parameter => {
        if (p.type === "Identifier") {
            return createParameter({ name: (p as Identifier).name });
        }
        if (p.type === "AssignmentPattern") {
            const ap = p as Node & {
                left?: { name?: string } | null;
                right?: Node | null;
            };
            const name = ap.left?.name ?? "param";
            const defaultValue = extractDefaultValue(ap.right);
            return createParameter({ name, defaultValue, isOptional: true });
        }
        if (p.type === "RestElement") {
            const re = p as Node & {
                argument?: { name?: string } | Node;
            };
            return createParameter({ name: (re.argument as { name?: string })?.name ?? "args", isRest: true });
        }
        if (p.type === "ObjectPattern") {
            const op = p as Node & {
                properties: ObjectPatternProp[];
            };
            const props = op.properties
                .map(prop => prop.key?.name ?? prop.key?.value ?? "?")
                .filter((v): v is string => !!v);
            return createParameter({ name: `{ ${props.join(", ")} }`, isDestructured: true, properties: props });
        }
        if (p.type === "ArrayPattern") {
            return createParameter({ name: "[...]", isDestructured: true });
        }
        return createParameter({ name: "unknown" });
    });
}

/**
 * Extract default value representation.
 */
function extractDefaultValue(node: Node | null | undefined): string | null {
    if (!node) return null;
    if (node.type === "NumericLiteral") return String((node as NumericLiteral).value);
    if (node.type === "StringLiteral") return `"${(node as StringLiteral).value}"`;
    if (node.type === "BooleanLiteral") return String((node as BooleanLiteral).value);
    if (node.type === "NullLiteral") return "null";
    if (node.type === "ObjectExpression") return "{}";
    if (node.type === "ArrayExpression") return "[]";
    return "...";
}

/**
 * Tìm JSDoc comment ngay trước một node.
 */
function findJSDoc(node: LocatedNode | Node | null | undefined, comments: LocatedComment[]): LocatedComment | null {
    if (!node?.loc) return null;
    const nodeLine = node.loc.start.line;

    return comments.find(c =>
        c.type === "CommentBlock" &&
        c.value.startsWith("*") &&
        c.loc.end.line === nodeLine - 1
    ) ?? null;
}

/**
 * Kiểm tra function body có return statement.
 */
function bodyHasReturn(body: BlockStatement | null | undefined): boolean {
    if (!body) return false;
    const json = JSON.stringify(body);
    return json.includes('"type":"ReturnStatement"');
}

/**
 * Tìm tất cả throw statements trong function body.
 */
function findThrows(body: BlockStatement | null | undefined): string[] {
    if (!body) return [];
    const throws: string[] = [];
    const json = JSON.stringify(body);
    // Simple detection: tìm ThrowStatement
    if (json.includes('"type":"ThrowStatement"')) {
        throws.push("Error");
    }
    return throws;
}

/**
 * Kiểm tra node có được export không.
 */
function isExported(path: NodePath): boolean {
    const parent = path.parent as Node | null;
    if (!parent) return false;
    if (parent.type === "ExportNamedDeclaration") return true;
    if (parent.type === "ExportDefaultDeclaration") return true;
    if (parent.type === "VariableDeclaration") {
        const grand = (path.parentPath?.parent as Node | null) ?? null;
        return grand?.type === "ExportNamedDeclaration";
    }
    return false;
}

/**
 * Tính cyclomatic complexity cho một function body.
 * Mỗi if, while, for, case, catch, &&, ||, ?? tăng 1.
 */
export function calculateComplexity(body: BlockStatement | null | undefined): number {
    if (!body) return 1;
    let complexity = 1;
    const json = JSON.stringify(body);

    const patterns = [
        '"type":"IfStatement"',
        '"type":"WhileStatement"',
        '"type":"ForStatement"',
        '"type":"ForInStatement"',
        '"type":"ForOfStatement"',
        '"type":"SwitchCase"',
        '"type":"CatchClause"',
        '"type":"ConditionalExpression"',
        '"type":"LogicalExpression"'
    ];

    for (const pattern of patterns) {
        const matches = json.split(pattern).length - 1;
        complexity += matches;
    }

    return complexity;
}

/**
 * Tính max nesting depth.
 */
export function calculateNesting(node: NestableNode | null | undefined, depth: number = 0): number {
    if (!node) return depth;

    let maxDepth = depth;
    const nestingTypes: Record<string, true> = {
        "IfStatement": true,
        "WhileStatement": true,
        "ForStatement": true,
        "ForInStatement": true,
        "ForOfStatement": true,
        "SwitchStatement": true,
        "TryStatement": true
    };

    if (node.body) {
        const stmts: NestableNode[] = Array.isArray(node.body)
            ? node.body
            : ((node.body as { body?: NestableNode[] | NestableNode }).body
                ? (Array.isArray((node.body as { body?: NestableNode[] }).body)
                    ? (node.body as { body: NestableNode[] }).body
                    : [(node.body as { body: NestableNode }).body])
                : [node.body as NestableNode]);
        for (const stmt of stmts) {
            const childDepth = nestingTypes[stmt.type]
                ? calculateNesting(stmt, depth + 1)
                : calculateNesting(stmt, depth);
            maxDepth = Math.max(maxDepth, childDepth);
        }
    }

    // consequent/alternate cho if
    if (node.consequent) maxDepth = Math.max(maxDepth, calculateNesting(node.consequent, depth));
    if (node.alternate) maxDepth = Math.max(maxDepth, calculateNesting(node.alternate, depth));

    // handler cho try
    if (node.handler) maxDepth = Math.max(maxDepth, calculateNesting(node.handler.body as unknown as NestableNode, depth + 1));

    // cases cho switch
    if (node.cases) {
        for (const c of node.cases) {
            for (const s of c.consequent ?? []) {
                maxDepth = Math.max(maxDepth, calculateNesting(s, depth));
            }
        }
    }

    return maxDepth;
}

/**
 * Detect complex code blocks cần explanation.
 */
function detectComplexBlocks(
    ast: unknown,
    result: AnalysisResult,
    comments: LocatedComment[],
    _lines: string[]
): void {
    traverse(ast, {
        ForStatement(path: NodePath) { maybeAddBlock(path, result, comments, "loop"); },
        WhileStatement(path: NodePath) { maybeAddBlock(path, result, comments, "loop"); },
        ForOfStatement(path: NodePath) { maybeAddBlock(path, result, comments, "loop"); },
        ForInStatement(path: NodePath) { maybeAddBlock(path, result, comments, "loop"); },
        SwitchStatement(path: NodePath) { maybeAddBlock(path, result, comments, "switch"); },
        TryStatement(path: NodePath) { maybeAddBlock(path, result, comments, "try"); },
        IfStatement(path: NodePath) {
            const complexity = calculateComplexity(path.node as unknown as BlockStatement);
            if (complexity >= 3) {
                maybeAddBlock(path, result, comments, "conditional");
            }
        }
    });
}

/**
 * Thêm code block vào result nếu phức tạp đủ (complexity >= 3 hoặc nesting >= 2).
 */
function maybeAddBlock(
    path: NodePath,
    result: AnalysisResult,
    comments: LocatedComment[],
    type: CodeBlock["type"]
): void {
    const node = path.node as LocatedNode;
    const complexity = calculateComplexity(node as unknown as BlockStatement);
    const nesting = calculateNesting(node as unknown as NestableNode);

    if (complexity < 3 && nesting < 2) return;

    const hasComment = comments.some(c =>
        c.loc.end.line === node.loc.start.line - 1 ||
        c.loc.start.line === node.loc.start.line
    );

    result.complexBlocks.push(createCodeBlock({
        startLine: node.loc.start.line,
        endLine: node.loc.end.line,
        complexity,
        nestingDepth: nesting,
        type,
        hasComment
    }));
}

/**
 * Detect ngôn ngữ comment (simple heuristic).
 * @param {string} text
 * @returns {'vi' | 'en' | null}
 */
export function detectCommentLanguage(text: string): CommentLanguage {
    if (!text || text.length < 5) return null;

    // Vietnamese specific characters
    const viChars = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    if (viChars.test(text)) return "vi";

    // Common Vietnamese words
    const viWords = /\b(và|cho|của|trong|với|không|này|các|được|đã|từ|những|có|để|khi|bởi|một|là)\b/i;
    if (viWords.test(text)) return "vi";

    // Common English words
    const enWords = /\b(the|and|for|with|this|that|from|are|was|has|have|not|but|will|can|should|would|could)\b/i;
    if (enWords.test(text)) return "en";

    return null;
}

export interface DiscoverJsFilesOpts {
    exclude?: string[];
    priorityPaths?: string[];
}

/**
 * Tìm tất cả JavaScript files trong một directory (đệ quy).
 * @param {string} dir - Đường dẫn thư mục
 * @param {DiscoverJsFilesOpts} [opts] - Tùy chọn
 * @param {string[]} [opts.exclude] - Glob patterns bỏ qua
 * @param {string[]} [opts.priorityPaths] - Thư mục ưu tiên (sorted first)
 * @returns {Promise<string[]>}
 */
export async function discoverJsFiles(dir: string, opts: DiscoverJsFilesOpts = {}): Promise<string[]> {
    const exclude = opts.exclude ?? ["node_modules", "dist", ".git", "coverage"];
    const priorityPaths = opts.priorityPaths ?? ["src/core", "src/systems"];

    const files: string[] = [];
    async function walk(current: string): Promise<void> {
        const entries = await readdir(current, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(current, entry.name);
            if (exclude.some(e => fullPath.includes(e))) continue;

            if (entry.isDirectory()) {
                await walk(fullPath);
            } else if (entry.isFile() && extname(entry.name) === ".js") {
                files.push(fullPath);
            }
        }
    }

    await walk(dir);

    // Sort: priority paths first
    if (priorityPaths.length) {
        files.sort((a, b) => {
            const aP = priorityPaths.some(p => a.includes(p)) ? 0 : 1;
            const bP = priorityPaths.some(p => b.includes(p)) ? 0 : 1;
            return aP - bP;
        });
    }

    return files;
}
