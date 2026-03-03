import type { BundledLanguage } from "shiki";
import { codeToTokens } from "shiki";
import { TabbedCodeBlock } from "./TabbedCodeBlock";

interface TabInput {
  label: string;
  lang: string;
  code: string;
}

interface CodeBlockGroupProps {
  tabs: TabInput[];
}

export async function CodeBlockGroup({ tabs }: CodeBlockGroupProps) {
  const highlighted = await Promise.all(
    tabs.map(async (tab) => {
      const { tokens } = await codeToTokens(tab.code, {
        lang: tab.lang as BundledLanguage,
        theme: "github-light",
      });

      const content = tokens.map((line, lineIdx) => (
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
      ));

      return {
        label: tab.label,
        code: tab.code,
        content: <>{content}</>,
      };
    }),
  );

  return <TabbedCodeBlock tabs={highlighted} />;
}
