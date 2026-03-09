/**
 * Context provided to the directive processor during sync/apply.
 */
export interface DirectiveContext {
    /** Absolute path to the project root */
    projectRoot: string;
    /** Current AI tool adapter key (e.g. "claude-code", "cursor") */
    currentTool: string;
    /** All AI tool keys being synced */
    detectedTools: readonly string[];
    /** Detected IDE platform keys (e.g. "vscode", "jetbrains") */
    detectedIdes: readonly string[];
    /** Placement scope: "project" or "global" */
    scope: string;
    /** Content type: "memory", "rules", "agents", "skills", "commands" */
    contentType: string;
}

/**
 * Options for directive processing.
 */
export interface DirectiveOptions {
    context: DirectiveContext;
    /** Callback for non-fatal warnings (missing files, unknown keys, etc.) */
    onWarning?: (message: string) => void;
}

/**
 * A single parsed directive extracted from content.
 */
export interface ParsedDirective {
    type: "include" | "if" | "endif";
    attributes: Record<string, string>;
    /** Start index of the full HTML comment in the source string */
    startIndex: number;
    /** End index (exclusive) of the full HTML comment */
    endIndex: number;
    /** The raw HTML comment text */
    raw: string;
}

/**
 * A matched pair of baton:if / baton:endif with nesting depth.
 */
export interface ConditionalBlock {
    ifDirective: ParsedDirective;
    endifDirective: ParsedDirective;
    /** Nesting depth (0 = top-level) */
    depth: number;
}
