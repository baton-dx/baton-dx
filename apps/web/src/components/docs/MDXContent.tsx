import { type ReactNode, isValidElement } from "react";
import { Info, Lightbulb, TriangleAlert, CircleAlert } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseContentSegments } from "@/lib/parse-content-segments";
import { CodeBlock } from "./CodeBlock";
import { CodeBlockGroup } from "./CodeBlockGroup";

// --- Callout variant system ---

type CalloutType = "tip" | "warning" | "info" | "important" | "note";

const CALLOUT_VARIANTS: Record<
  CalloutType,
  {
    icon: typeof Info;
    borderCss: string;
    bg: string;
    iconColor: string;
    label: string;
  }
> = {
  tip: {
    icon: Lightbulb,
    borderCss: "#a7f3d0",
    bg: "bg-emerald-50/60",
    iconColor: "text-emerald-600",
    label: "Tip",
  },
  warning: {
    icon: TriangleAlert,
    borderCss: "#fde68a",
    bg: "bg-amber-50/60",
    iconColor: "text-amber-600",
    label: "Warning",
  },
  info: {
    icon: Info,
    borderCss: "#bfdbfe",
    bg: "bg-blue-50/60",
    iconColor: "text-blue-600",
    label: "Info",
  },
  important: {
    icon: CircleAlert,
    borderCss: "#e9d5ff",
    bg: "bg-purple-50/60",
    iconColor: "text-purple-600",
    label: "Important",
  },
  note: {
    icon: Info,
    borderCss: "#bfdbfe",
    bg: "bg-blue-50/60",
    iconColor: "text-blue-600",
    label: "Note",
  },
};

const CALLOUT_PATTERNS: Array<{ pattern: RegExp; type: CalloutType }> = [
  { pattern: /^tip:/i, type: "tip" },
  { pattern: /^hint:/i, type: "tip" },
  { pattern: /^warning:/i, type: "warning" },
  { pattern: /^caution:/i, type: "warning" },
  { pattern: /^important:/i, type: "important" },
  { pattern: /^info:/i, type: "info" },
  { pattern: /^note:/i, type: "note" },
];

function getTextContent(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getTextContent).join("");
  if (isValidElement(node) && node.props) {
    return getTextContent((node.props as { children?: ReactNode }).children);
  }
  return "";
}

function detectCalloutType(children: ReactNode): CalloutType {
  const text = getTextContent(children).trim();
  for (const { pattern, type } of CALLOUT_PATTERNS) {
    if (pattern.test(text)) return type;
  }
  return "note";
}

// --- Component ---

interface MDXContentProps {
  content: string;
}

export async function MDXContent({ content }: MDXContentProps) {
  const segments = parseContentSegments(content);

  return (
    <>
      {segments.map((segment, idx) => {
        if (segment.type === "tab-group") {
          return <CodeBlockGroup key={idx} tabs={segment.tabs} />;
        }

        return (
          <ReactMarkdown
            key={idx}
            remarkPlugins={[remarkGfm]}
            components={{
              // Strip default <pre> wrapper — CodeBlock provides its own container
              // biome-ignore lint/suspicious/noExplicitAny: react-markdown components
              pre({ children }: any) {
                return <>{children}</>;
              },

              // Code blocks
              // biome-ignore lint/suspicious/noExplicitAny: react-markdown passes children as any
              code({ node: _node, className, children, ...props }: any) {
                const codeStr = String(children).replace(/\n$/, "");

                // Inline code: no language class AND single-line
                if (!className && !codeStr.includes("\n")) {
                  return (
                    <code
                      className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }

                const lang = className?.replace("language-", "") ?? "text";
                return <CodeBlock code={codeStr} lang={lang} />;
              },

              // Tables
              // biome-ignore lint/suspicious/noExplicitAny: react-markdown components
              table({ node: _node, children, ...props }: any) {
                return (
                  <div className="my-4 overflow-x-auto">
                    <table className="w-full text-sm" {...props}>
                      {children}
                    </table>
                  </div>
                );
              },
              // biome-ignore lint/suspicious/noExplicitAny: react-markdown components
              th({ node: _node, children, ...props }: any) {
                return (
                  <th
                    className="border border-border bg-muted/50 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                    {...props}
                  >
                    {children}
                  </th>
                );
              },
              // biome-ignore lint/suspicious/noExplicitAny: react-markdown components
              td({ node: _node, children, ...props }: any) {
                return (
                  <td className="border border-border px-3 py-2 text-sm text-foreground" {...props}>
                    {children}
                  </td>
                );
              },

              // Blockquotes — Obsidian-style callouts with icon + color variants
              // biome-ignore lint/suspicious/noExplicitAny: react-markdown components
              blockquote({ node: _node, children, ...props }: any) {
                const type = detectCalloutType(children);
                const v = CALLOUT_VARIANTS[type];
                const Icon = v.icon;

                return (
                  <blockquote
                    className={`my-5 rounded-lg border-l-4 ${v.bg} py-4 pl-4 pr-5 not-italic [&>p]:m-0 [&>p+p]:mt-3`}
                    style={{ borderLeftColor: v.borderCss }}
                    {...props}
                  >
                    <div className="flex items-start gap-3">
                      <Icon
                        size={16}
                        className={`mt-[3px] shrink-0 ${v.iconColor}`}
                      />
                      <div className="min-w-0 text-sm text-foreground">
                        {children}
                      </div>
                    </div>
                  </blockquote>
                );
              },

              // Links
              // biome-ignore lint/suspicious/noExplicitAny: react-markdown components
              a({ node: _node, href, children, ...props }: any) {
                return (
                  <a
                    href={href}
                    className="text-brand-600 underline underline-offset-2 hover:text-brand-700"
                    {...props}
                  >
                    {children}
                  </a>
                );
              },

              // Headings with anchor IDs
              // biome-ignore lint/suspicious/noExplicitAny: react-markdown components
              h2({ node: _node, children, ...props }: any) {
                const id = String(children)
                  .toLowerCase()
                  .replace(/[^\w\s-]/g, "")
                  .replace(/\s+/g, "-");
                return (
                  <h2
                    id={id}
                    className="mt-10 scroll-mt-20 text-xl font-semibold text-foreground"
                    {...props}
                  >
                    {children}
                  </h2>
                );
              },
              // biome-ignore lint/suspicious/noExplicitAny: react-markdown components
              h3({ node: _node, children, ...props }: any) {
                const id = String(children)
                  .toLowerCase()
                  .replace(/[^\w\s-]/g, "")
                  .replace(/\s+/g, "-");
                return (
                  <h3
                    id={id}
                    className="mt-6 scroll-mt-20 text-base font-semibold text-foreground"
                    {...props}
                  >
                    {children}
                  </h3>
                );
              },
            }}
          >
            {segment.content}
          </ReactMarkdown>
        );
      })}
    </>
  );
}
