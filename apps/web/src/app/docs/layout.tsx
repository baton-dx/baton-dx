import type { ReactNode } from "react";
import { docs } from "@/.velite";
import { Sidebar } from "@/components/docs/Sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Header } from "@/components/layout/Header";

export default function DocsLayout({ children }: { children: ReactNode }) {
  const sortedDocs = [...docs].sort((a, b) => a.order - b.order);
  const navDocs = sortedDocs.map((d) => ({
    title: d.title,
    href: d.href,
    section: d.section,
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <Header section="docs" />

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
