import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-foreground">
          <img src="/baton-dx_Logo.svg" alt="Baton" className="h-7 w-auto" />
          <span className="text-[15px] tracking-tight">Baton</span>
        </Link>

        {/* Nav */}
        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="https://docs.batondx.dev"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Docs
          </Link>
          <Link
            href="https://github.com/batondx/baton-dx"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </Link>
        </nav>

        {/* CTA */}
        <Link
          href="https://docs.batondx.dev/installation"
          className={buttonVariants({ size: "sm" })}
        >
          Get Started
        </Link>
      </div>
    </header>
  );
}