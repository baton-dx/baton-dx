/**
 * Context provided to the directive processor during sync/apply.
 */
export interface DirectiveContext {
    /** Absolute path to the project root */
    projectRoot: string;
    /** Absolute path to the profile's local directory (for profile-relative includes) */
    profileRoot?: string;
    /** Profile name (used for placement target paths in .baton/includes/) */
    profileName?: string;
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
    /** User-defined variables from baton.yaml */
    variables?: Record<string, string>;
}

/**
 * Describes a file that needs to be copied from a profile source
 * to .baton/includes/ for link/reference mode includes.
 */
export interface FilePlacement {
    /** Absolute path to the source file in the profile */
    sourcePath: string;
    /** Relative target path under project root (e.g. ".baton/includes/my-profile/fragment.md") */
    targetRelative: string;
    /** The profile name this placement belongs to */
    profileName: string;
}

/**
 * Options for directive processing.
 */
export interface DirectiveOptions {
    context: DirectiveContext;
    /** Callback for non-fatal warnings (missing files, unknown keys, etc.) */
    onWarning?: (message: string) => void;
    /** Callback emitted when a profile-relative link/reference include needs file placement */
    onPlacement?: (placement: FilePlacement) => void;
    /** When true, annotate output with [INCLUDED]/[EXCLUDED] markers for preview/explain mode */
    explain?: boolean;
}

/**
 * A single parsed directive extracted from content.
 */
export interface ParsedDirective {
    type: "include" | "if" | "else" | "endif";
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
    /** Optional baton:else directive within the block */
    elseDirective?: ParsedDirective;
    endifDirective: ParsedDirective;
    /** Nesting depth (0 = top-level) */
    depth: number;
}
