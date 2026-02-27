import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DocEntry {
  title: string;
  href: string;
}

interface DocsPrevNextProps {
  prev?: DocEntry;
  next?: DocEntry;
}

export function DocsPrevNext({ prev, next }: DocsPrevNextProps) {
  return (
    <div className="mt-12 flex items-center justify-between border-t border-border pt-8">
      {prev ? (
        <Link
          href={prev.href}
          className="group flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          <span>
            <span className="block text-xs text-muted-foreground/70">Previous</span>
            {prev.title}
          </span>
        </Link>
      ) : (
        <span />
      )}

      {next ? (
        <Link
          href={next.href}
          className="group flex items-center gap-2 text-right text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <span>
            <span className="block text-xs text-muted-foreground/70">Next</span>
            {next.title}
          </span>
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : (
        <span />
      )}
    </div>
  );
}
