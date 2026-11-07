declare module "@babel/traverse" {
    import type { Node, Comment, SourceLocation } from "@babel/types";

    export interface NodePath<N extends Node = Node> {
        node: N;
        parent: Node;
        parentPath?: NodePath | null;
        scope?: unknown;
        hub?: unknown;
        state?: unknown;
        key?: string | number | undefined;
        listKey?: string | undefined;
        container?: Node | Node[] | undefined;
        isX?: (opts?: unknown) => boolean;
        get?: (key: string) => NodePath | NodePath[];
    }

    export type VisitNodeFunction<NodePathT extends NodePath = NodePath, T extends Node = Node> =
        (this: unknown, path: NodePathT<T>) => void;

    export type Visitor<S = unknown> = {
        [K in keyof ImportVisitor<S>]?: ImportVisitor<S>[K];
    } & {
        [key: string]: ((path: NodePath & { [key: string]: unknown }) => void) | undefined;
        enter?: (path: NodePath, state: S) => void;
        exit?: (path: NodePath, state: S) => void;
    };

    export interface ImportVisitor<S = unknown> {
        enter?: VisitNodeFunction<NodePath, Node> | undefined;
        exit?: VisitNodeFunction<NodePath, Node> | undefined;
    }

    export interface TraverseOptions<S = unknown> {
        visitor: Visitor<S>;
        state?: S;
    }

    /**
     * The traverse function is callable directly and also has a `.default`
     * property for CJS/ESM interop: `import _traverse from "@babel/traverse";
     * const traverse = _traverse.default ?? _traverse;`
     */
    export type TraverseFn = {
        (ast: { comments?: unknown } | unknown, visitorOrOpts: Visitor | TraverseOptions): void;
        (path: NodePath, visitorOrOpts: Visitor | TraverseOptions): void;
        default?: TraverseFn;
        cache?: unknown;
        babel?: unknown;
    };

    const traverse: TraverseFn;

    export default traverse;
    export { traverse };
}
