"use client";

import { useState } from "react";
import { CopyButton } from "@/components/docs/CopyButton";

interface CommandTab {
  label: string;
  command: string;
}

interface CommandTabsProps {
  tabs: CommandTab[];
}

export function CommandTabs({ tabs }: CommandTabsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div className="flex items-center border-b border-border bg-muted/40">
        <div className="flex gap-1 overflow-x-auto px-2">
          {tabs.map((tab, idx) => (
            <button
              key={tab.label}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`relative shrink-0 rounded-md px-3 py-1.5 font-mono text-xs transition-colors ${
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
        <div className="ml-auto shrink-0 px-2">
          <CopyButton code={tabs[activeIndex].command} />
        </div>
      </div>
      <div className="bg-muted/30 p-4">
        <pre className="overflow-x-auto text-sm leading-6">
          <code>
            <span className="select-none text-muted-foreground/50">$ </span>
            <span className="text-foreground">{tabs[activeIndex].command}</span>
          </code>
        </pre>
      </div>
    </div>
  );
}
