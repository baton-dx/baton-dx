import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./CodeBlock";

interface MDXContentProps {
  content: string;
}

export function MDXContent({ content }: MDXContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Code blocks
        // biome-ignore lint/suspicious/noExplicitAny: react-markdown passes children as any
        code({ node: _node, className, children, ...props }: any) {
          const lang = className?.replace("language-", "") ?? "text";
          const codeStr = String(children).replace(/\n$/, "");
          // Inline code: parent is not pre
          if (!className) {
            return (
              <code
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
                {...props}
              >
                {children}
              </code>
            );
          }
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

        // Blockquotes
        // biome-ignore lint/suspicious/noExplicitAny: react-markdown components
        blockquote({ node: _node, children, ...props }: any) {
          return (
            <blockquote
              className="my-4 border-l-4 border-brand-300 bg-brand-50/50 px-4 py-3 text-sm text-muted-foreground [&>p]:m-0"
              {...props}
            >
              {children}
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
      {content}
    </ReactMarkdown>
  );
}
