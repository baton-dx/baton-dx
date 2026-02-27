import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 font-semibold text-foreground">
          <BatonLogo className="h-7 w-7" />
          <span className="text-[15px] tracking-tight">Baton DX</span>
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

function BatonLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" fill="currentColor" className="text-brand-600" />
      <path
        d="M8 8h6a5 5 0 0 1 0 10H8V8Zm0 10h7a5 5 0 0 1 0 10H8V18Z"
        fill="white"
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
}
