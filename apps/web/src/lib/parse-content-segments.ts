export type Segment =
  | { type: "markdown"; content: string }
  | { type: "tab-group"; tabs: Array<{ label: string; lang: string; code: string }> };

const FENCE_OPEN = /^```(\w+)\s+tab="([^"]+)"\s*$/;
const FENCE_CLOSE = /^```\s*$/;

export function parseContentSegments(markdown: string): Segment[] {
  const lines = markdown.split("\n");
  const segments: Segment[] = [];
  let markdownLines: string[] = [];
  let pendingTabs: Array<{ label: string; lang: string; code: string }> = [];
  let currentTab: { label: string; lang: string; lines: string[] } | null = null;

  function flushMarkdown() {
    if (markdownLines.length > 0) {
      const content = markdownLines.join("\n").trim();
      if (content) {
        segments.push({ type: "markdown", content });
      }
      markdownLines = [];
    }
  }

  function flushTabs() {
    if (pendingTabs.length > 0) {
      segments.push({ type: "tab-group", tabs: pendingTabs });
      pendingTabs = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Inside a tab code block — collect lines until closing fence
    if (currentTab) {
      if (FENCE_CLOSE.test(line)) {
        pendingTabs.push({
          label: currentTab.label,
          lang: currentTab.lang,
          code: currentTab.lines.join("\n"),
        });
        currentTab = null;
      } else {
        currentTab.lines.push(line);
      }
      continue;
    }

    // Check for tab-annotated fence opening
    const fenceMatch = FENCE_OPEN.exec(line);
    if (fenceMatch) {
      // If we have no pending tabs, flush any preceding markdown
      if (pendingTabs.length === 0) {
        flushMarkdown();
      }
      currentTab = { lang: fenceMatch[1], label: fenceMatch[2], lines: [] };
      continue;
    }

    // If we have pending tabs and hit a non-empty, non-tab line, flush the tab group
    if (pendingTabs.length > 0 && line.trim() !== "") {
      flushTabs();
    }

    // Skip blank lines between consecutive tab blocks
    if (pendingTabs.length > 0 && line.trim() === "") {
      continue;
    }

    markdownLines.push(line);
  }

  // Flush remaining state
  flushTabs();
  flushMarkdown();

  return segments;
}
