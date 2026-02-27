"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface DocEntry {
  title: string;
  href: string;
  section: string;
}

interface SidebarProps {
  docs: DocEntry[];
}

function groupBySection(docs: DocEntry[]) {
  const groups: Record<string, DocEntry[]> = {};
  for (const doc of docs) {
    if (!groups[doc.section]) groups[doc.section] = [];
    groups[doc.section].push(doc);
  }
  return groups;
}

export function Sidebar({ docs }: SidebarProps) {
  const pathname = usePathname();
  const groups = groupBySection(docs);

  return (
    <nav className="w-full">
      {Object.entries(groups).map(([section, entries]) => (
        <div key={section} className="mb-6">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {section}
          </p>
          <ul className="space-y-0.5">
            {entries.map((entry) => {
              const isActive = pathname === entry.href;
              return (
                <li key={entry.href}>
                  <Link
                    href={entry.href}
                    className={cn(
                      "block rounded-md px-3 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-brand-50 font-medium text-brand-700"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {entry.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
