import type { BundledLanguage } from "shiki";
import { codeToTokens } from "shiki";
import { CopyButton } from "./CopyButton";

const LANG_LABELS: Record<string, string> = {
  bash: "Terminal",
  sh: "Terminal",
  shell: "Terminal",
  zsh: "Terminal",
  yaml: "YAML",
  yml: "YAML",
  json: "JSON",
  jsonc: "JSONC",
  toml: "TOML",
  ts: "TypeScript",
  typescript: "TypeScript",
  tsx: "TSX",
  js: "JavaScript",
  javascript: "JavaScript",
  jsx: "JSX",
  css: "CSS",
  html: "HTML",
  md: "Markdown",
  markdown: "Markdown",
  text: "Plain Text",
};

interface CodeBlockProps {
  code: string;
  lang?: string;
  filename?: string;
}

const PLAIN_LANGS = new Set(["text", "plaintext", "txt", "plain"]);

export async function CodeBlock({ code, lang = "bash", filename }: CodeBlockProps) {
  const isPlain = PLAIN_LANGS.has(lang);

  const tokens = isPlain
    ? null
    : (await codeToTokens(code, { lang: lang as BundledLanguage, theme: "github-light" })).tokens;

  const label = filename ?? LANG_LABELS[lang] ?? lang;

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
        <span className="font-mono text-xs text-muted-foreground">{label}</span>
        <CopyButton code={code} />
      </div>
      <div className="bg-muted/30 p-5">
        <pre className="overflow-x-auto text-sm leading-6">
          <code>
            {tokens
              ? tokens.map((line, lineIdx) => (
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
                ))
              : <span style={{ color: 'var(--foreground)' }}>{code}</span>
            }
          </code>
        </pre>
      </div>
    </div>
  );
}
