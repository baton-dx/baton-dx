"use client";

import { type ReactNode, useState } from "react";
import { CopyButton } from "./CopyButton";

interface Tab {
  label: string;
  code: string;
  content: ReactNode;
}

interface TabbedCodeBlockProps {
  tabs: Tab[];
}

export function TabbedCodeBlock({ tabs }: TabbedCodeBlockProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-2">
        <div className="flex gap-1">
          {tabs.map((tab, idx) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`relative rounded-md px-3 py-1.5 font-mono text-xs transition-colors ${
                idx === activeIndex
                  ? "font-medium text-brand-700"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              {idx === activeIndex && (
                <span className="absolute bottom-0 left-1/2 h-0.5 w-4/5 -translate-x-1/2 rounded-full bg-brand-500" />
              )}
            </button>
          ))}
        </div>
        <CopyButton code={tabs[activeIndex].code} />
      </div>
      {tabs.map((tab, idx) => (
        <div
          key={tab.label}
          className={`bg-muted/30 p-5 ${idx === activeIndex ? "block" : "hidden"}`}
        >
          <pre className="overflow-x-auto text-sm leading-6">
            <code>{tab.content}</code>
          </pre>
        </div>
      ))}
    </div>
  );
}
