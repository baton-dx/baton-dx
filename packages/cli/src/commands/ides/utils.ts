/**
 * Format an IDE platform key into a display name.
 */
export function formatIdeName(ideKey: string): string {
    const names: Record<string, string> = {
        vscode: "VS Code",
        jetbrains: "JetBrains",
        cursor: "Cursor",
        windsurf: "Windsurf",
        antigravity: "Antigravity",
        zed: "Zed",
    };
    return names[ideKey] ?? ideKey;
}
