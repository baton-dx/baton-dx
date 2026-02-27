import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function CTASection() {
  return (
    <section className="border-t border-border py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Start managing your AI configs today
        </h2>
        <p className="mt-4 text-lg text-muted-foreground">
          Join developers who use Baton DX to keep their AI tools in sync —
          across projects, teams, and machines.
        </p>

        {/* Install command */}
        <div className="mt-8 flex items-center justify-center gap-2 rounded-xl border border-border bg-muted/50 px-5 py-3.5 font-mono text-sm">
          <span className="select-none text-muted-foreground/60">$</span>
          <span className="select-all text-foreground">npm install -g @baton-dx/cli</span>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="https://docs.batondx.dev/installation"
            className={buttonVariants({ size: "lg" })}
          >
            Read the Docs →
          </Link>
          <Link
            href="https://github.com/batondx/baton-dx"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Star on GitHub ★
          </Link>
        </div>
      </div>
    </section>
  );
}
