import { GitBranch, Wrench, Shuffle, Layers } from "lucide-react";

const features = [
  {
    icon: GitBranch,
    title: "Versioned Profiles",
    description:
      "Store configs in Git repos or npm packages. Track changes, roll back anytime, and share across your team with a lockfile.",
  },
  {
    icon: Wrench,
    title: "14 AI Tools",
    description:
      "Supports Claude Code, Cursor, GitHub Copilot, Windsurf, Zed, Gemini, and 8 more AI coding tools out of the box.",
  },
  {
    icon: Shuffle,
    title: "8 Merge Strategies",
    description:
      "Replace, deep-merge, append, prepend, skip, prompt, directory, or import. Full control over how configs compose.",
  },
  {
    icon: Layers,
    title: "Project & Global Scope",
    description:
      "Apply configs per-project or globally in your home directory. Profiles inherit, compose, and override cleanly.",
  },
];

export function Features() {
  return (
    <section className="border-t border-border bg-muted/20 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything you need to manage AI configs
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            One tool to rule all your AI coding assistant configurations.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className="group rounded-xl border border-border bg-background p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-base font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
