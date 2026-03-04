"use client";

import { useState } from "react";
import { CopyButton } from "@/components/docs/CopyButton";

const tabs = [
  { label: "bun", command: "bun add -g @baton-dx/cli" },
  { label: "pnpm", command: "pnpm add -g @baton-dx/cli" },
  { label: "npm", command: "npm install -g @baton-dx/cli" },
  { label: "yarn", command: "yarn global add @baton-dx/cli" },
  { label: "Homebrew", command: "brew install baton-dx" },
];

export function HeroTerminal() {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="relative z-10 overflow-hidden rounded-lg border border-border bg-white shadow-2xl backdrop-blur-md">
      {/* Header with traffic lights, tabs, and copy */}
      <div className="flex items-center border-b border-border bg-zinc-100/60 px-4 py-2">
        <div className="flex items-center gap-3 overflow-x-auto">
          {/* macOS traffic light dots */}
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500/80" />
            <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
            <span className="h-3 w-3 rounded-full bg-green-500/80" />
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
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
        </div>

        <div className="ml-auto shrink-0 pl-2">
          <CopyButton code={tabs[activeIndex].command} />
        </div>
      </div>

      {/* Command body */}
      <div className="bg-zinc-50/80 p-5">
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
