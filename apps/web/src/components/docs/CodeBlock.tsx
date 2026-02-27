import { codeToTokens } from "shiki";

interface CodeBlockProps {
  code: string;
  lang?: string;
  filename?: string;
}

export async function CodeBlock({ code, lang = "bash", filename }: CodeBlockProps) {
  const { tokens, fg, bg } = await codeToTokens(code, {
    lang,
    theme: "github-dark",
  });

  return (
    <div className="group relative my-4 overflow-hidden rounded-lg border border-border">
      {filename && (
        <div className="border-b border-white/10 bg-zinc-900 px-4 py-2 font-mono text-xs text-zinc-400">
          {filename}
        </div>
      )}
      <pre
        className="overflow-x-auto p-4 text-sm leading-6"
        style={{ backgroundColor: bg, color: fg }}
      >
        <code>
          {tokens.map((line, lineIdx) => (
            <span key={lineIdx} className="block">
              {line.map((token, tokenIdx) => (
                <span
                  key={tokenIdx}
                  style={{
                    color: token.color,
                    fontStyle: token.fontStyle ? "italic" : undefined,
                  }}
                >
                  {token.content}
                </span>
              ))}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
