import type { ReactNode } from "react";
import Link from "next/link";
import { docs } from "@/.velite";
import { Sidebar } from "@/components/docs/Sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function DocsLayout({ children }: { children: ReactNode }) {
  const sortedDocs = [...docs].sort((a, b) => a.order - b.order);
  const navDocs = sortedDocs.map((d) => ({
    title: d.title,
    href: d.href,
    section: d.section,
  }));

  return (
    <div className="flex min-h-screen flex-col">
      {/* Docs Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-8xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold text-foreground">
            <DocsBatonLogo className="h-6 w-6" />
            <span className="text-sm">Baton DX</span>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-sm text-muted-foreground">Docs</span>

          <div className="ml-auto flex items-center gap-4">
            <Link
              href="https://github.com/batondx/baton-dx"
              className="text-sm text-muted-foreground hover:text-foreground"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </Link>
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="mx-auto flex w-full max-w-8xl flex-1 px-4 sm:px-6">
        {/* Sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <ScrollArea className="sticky top-14 h-[calc(100vh-3.5rem)] py-6 pr-4">
            <Sidebar docs={navDocs} />
          </ScrollArea>
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 py-8 lg:pl-8 xl:pr-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function DocsBatonLogo({ className }: { className?: string }) {
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
