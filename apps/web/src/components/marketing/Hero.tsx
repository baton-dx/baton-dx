import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

const heroCode = `# Install Baton DX
npm install -g @baton-dx/cli

# Initialize in your project
baton init

# Add a source (Git repo with configs)
baton source add gh:myorg/ai-configs

# Sync profiles to your tools
baton sync`;

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background py-20 sm:py-28 lg:py-32">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 -z-10 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* Gradient blob */}
      <div className="absolute -top-40 right-0 -z-10 h-[600px] w-[600px] rounded-full bg-brand-500/10 blur-3xl" />

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — copy */}
          <div>
            <div className="mb-5 inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              Open Source · 14 AI Tools Supported
            </div>

            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Manage AI&nbsp;Tool
              <br />
              <span className="text-brand-600">Configs Like a Pro</span>
            </h1>

            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Baton DX is a CLI package manager for Developer Experience &amp;
              AI configuration. Version, share, and sync AI tool configs across
              14 tools with a single command.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="https://github.com/batondx/baton-dx"
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                View on GitHub
              </Link>
            </div>

            <p className="mt-4 font-mono text-sm text-muted-foreground">
              <span className="select-none text-muted-foreground/50">$ </span>
              npm install -g @baton-dx/cli
            </p>
          </div>

          {/* Right — code snippet */}
          <div className="relative">
            <div className="overflow-hidden rounded-xl border border-border bg-zinc-950 shadow-2xl">
              {/* Window chrome */}
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-red-500/80" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/80" />
                <span className="h-3 w-3 rounded-full bg-green-500/80" />
                <span className="ml-3 text-xs text-white/40">terminal</span>
              </div>

              {/* Code */}
              <pre className="overflow-x-auto p-5 text-sm leading-7">
                <code>
                  {heroCode.split("\n").map((line, i) => (
                    <HeroCodeLine key={i} line={line} />
                  ))}
                </code>
              </pre>
            </div>

            {/* Decorative glow */}
            <div className="absolute -bottom-8 -right-8 -z-10 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroCodeLine({ line }: { line: string }) {
  if (line.startsWith("#")) {
    return (
      <span className="block text-zinc-500">
        {line}
        {"\n"}
      </span>
    );
  }
  if (line === "") {
    return <span className="block">{"\n"}</span>;
  }
  // Command — split at first space to color the command name
  const spaceIdx = line.indexOf(" ");
  if (spaceIdx === -1) {
    return (
      <span className="block">
        <span className="text-emerald-400">{line}</span>
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
