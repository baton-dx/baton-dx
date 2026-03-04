import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { HeroTerminal } from "./HeroTerminal";

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
              Manage AI&nbsp;Tool Configs
              <br />
              <span className="text-3xl text-brand-600 sm:text-4xl lg:text-5xl">Like a Pro</span>
            </h1>

            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              Baton DX is a CLI package manager for Developer Experience &amp;
              AI configuration. Version, share, and sync AI tool configs across
              14 tools with a single command.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/docs"
                className={buttonVariants({ variant: "default", size: "lg" })}
              >
                Get Started
              </Link>
              <Link
                href="https://github.com/baton-dx/baton-dx"
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                View on GitHub
              </Link>
            </div>
          </div>

          {/* Right — terminal */}
          <div className="relative">
            <HeroTerminal />

            {/* Decorative glow */}
            <div className="absolute -bottom-8 -right-8 -z-10 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
