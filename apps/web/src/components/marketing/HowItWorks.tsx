const steps = [
  {
    number: "01",
    title: "Install Baton DX",
    description:
      "Install the CLI globally with npm, Homebrew, or your preferred package manager. Works on macOS, Linux, and Windows.",
    code: "npm install -g @baton-dx/cli\n\n# or via Homebrew\nbrew install batondx/tap/baton-dx",
  },
  {
    number: "02",
    title: "Create a Source",
    description:
      "Point Baton to a Git repo or npm package containing AI tool configurations. Sources are versioned and shareable.",
    code: "# Initialize your project\nbaton init\n\n# Add a source\nbaton source add gh:myorg/ai-configs",
  },
  {
    number: "03",
    title: "Sync Profiles",
    description:
      "Run baton sync to pull selected profiles into your project or home directory. Configs are placed exactly where each tool expects them.",
    code: "# Select and sync profiles\nbaton sync\n\n# Check what was placed\nbaton status",
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

                {/* Code block */}
                <div className="overflow-hidden rounded-lg bg-zinc-950">
                  <pre className="overflow-x-auto p-4 text-xs leading-6">
                    <code>
                      {step.code.split("\n").map((line, i) => (
                        <StepCodeLine key={i} line={line} />
                      ))}
                    </code>
                  </pre>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StepCodeLine({ line }: { line: string }) {
  if (line.startsWith("#")) {
    return (
      <span className="block text-zinc-500">
        {line}
        {"\n"}
      </span>
    );
  }
  if (line === "") {
    return <span className="block text-zinc-300">{"\n"}</span>;
  }
  const spaceIdx = line.indexOf(" ");
  if (spaceIdx === -1) {
    return (
      <span className="block text-emerald-400">
        {line}
        {"\n"}
      </span>
    );
  }
  return (
    <span className="block">
      <span className="text-emerald-400">{line.slice(0, spaceIdx)}</span>
      <span className="text-zinc-300">{line.slice(spaceIdx)}</span>
      {"\n"}
    </span>
  );
}
