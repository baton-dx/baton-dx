import Link from "next/link";

type HeaderSection = "landing" | "docs" | "marketplace";

const sectionLabels: Record<HeaderSection, string> = {
  landing: "Baton DX",
  docs: "Docs",
  marketplace: "Marketplace",
};

const navItems = [
  { label: "Docs", href: "https://docs.batondx.dev", section: "docs" },
  { label: "Marketplace", href: "https://marketplace.batondx.dev", section: "marketplace" },
] as const;

async function getStarCount(): Promise<number | null> {
  try {
    const res = await fetch("https://api.github.com/repos/batondx/baton-dx", {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.stargazers_count === "number" ? data.stargazers_count : null;
  } catch {
    return null;
  }
}

function formatStars(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(count);
}

export async function Header({ section = "landing" }: { section?: HeaderSection }) {
  const stars = await getStarCount();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-white/50 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6 lg:px-8">
        {/* Logo + Section Label */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center">
            <img src="/baton-dx_Logo.svg" alt="Baton DX" className="h-6 w-auto" />
          </Link>
          <span className="text-lg font-bold tracking-tight text-foreground">
            {sectionLabels[section]}
          </span>
        </div>

        {/* Nav */}
        <nav className="ml-8 hidden items-center gap-6 md:flex">
          {navItems
            .filter((item) => item.section !== section)
            .map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
        </nav>

        {/* GitHub Stars — pushed to far right */}
        <div className="ml-auto">
          <Link
            href="https://github.com/batondx/baton-dx"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <GitHubIcon />
            {stars !== null && (
              <>
                <span className="text-xs text-muted-foreground/60">|</span>
                <span className="text-xs font-medium">
                  <StarIcon />
                </span>
                <span className="text-xs font-medium">{formatStars(stars)}</span>
              </>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}

function GitHubIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25z" />
    </svg>
  );
}
