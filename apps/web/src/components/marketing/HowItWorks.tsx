import type { ReactNode } from "react";
import { CommandTabs } from "./CommandTabs";
import { InstallTabs } from "./InstallTabs";

const steps: { number: string; title: string; description: string; codeBlock: ReactNode }[] = [
  {
    number: "01",
    title: "Install Baton DX",
    description:
      "Install the CLI globally with bun, npm, or your preferred package manager. Works on macOS, Linux, and Windows.",
    codeBlock: <InstallTabs />,
  },
  {
    number: "02",
    title: "Create a Source",
    description:
      "Point Baton to a Git repo or npm package containing AI tool configurations. Sources are versioned and shareable.",
    codeBlock: (
      <CommandTabs
        tabs={[
          { label: "init", command: "baton init" },
          { label: "add source", command: "baton source add gh:myorg/ai-configs" },
        ]}
      />
    ),
  },
  {
    number: "03",
    title: "Sync Profiles",
    description:
      "Run baton sync to pull selected profiles into your project or home directory. Configs are placed exactly where each tool expects them.",
    codeBlock: (
      <CommandTabs
        tabs={[
          { label: "sync", command: "baton sync" },
          { label: "status", command: "baton status" },
        ]}
      />
    ),
  },
];

export function HowItWorks() {
  return (
    <section className="border-t border-border bg-muted/20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Get started in 3 steps
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From zero to synced configs in under 5 minutes.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {/* Connector line (not on last item) */}
              {index < steps.length - 1 && (
                <div className="absolute left-full top-7 hidden h-px w-8 bg-border lg:block" />
              )}

              <div className="rounded-xl border border-border bg-background p-6 shadow-sm">
                <div className="mb-4 flex items-center gap-3">
                  <span className="font-mono text-2xl font-bold text-brand-600/30">
                    {step.number}
                  </span>
                  <h3 className="text-base font-semibold text-foreground">
                    {step.title}
                  </h3>
                </div>

                <p className="mb-4 text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>

                {step.codeBlock}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
