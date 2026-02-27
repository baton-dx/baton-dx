import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { docs } from "@/.velite";
import { MDXContent } from "@/components/docs/MDXContent";
import { TableOfContents } from "@/components/docs/TableOfContents";
import { DocsPrevNext } from "@/components/docs/DocsPrevNext";

interface PageProps {
  params: Promise<{ slug?: string[] }>;
}

function getDocFromSlug(slug: string[] | undefined) {
  const path = slug ? slug.join("/") : "installation";
  return docs.find((d) => d.slug === path);
}

export async function generateStaticParams() {
  return docs.map((doc) => ({
    slug: doc.slug.split("/"),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = getDocFromSlug(slug);
  if (!doc) return {};
  return {
    title: doc.title,
    description: doc.description,
  };
}

export default async function DocsPage({ params }: PageProps) {
  const { slug } = await params;
  const doc = getDocFromSlug(slug);
  if (!doc) notFound();

  const sortedDocs = [...docs].sort((a, b) => a.order - b.order);
  const idx = sortedDocs.findIndex((d) => d.slug === doc.slug);
  const prev = idx > 0 ? sortedDocs[idx - 1] : undefined;
  const next = idx < sortedDocs.length - 1 ? sortedDocs[idx + 1] : undefined;

  // Velite generates toc as { id, text, depth }[]
  const tocEntries = (doc.toc ?? []).map((entry) => ({
    id: entry.id,
    text: entry.text,
    level: entry.depth,
  }));

  return (
    <div className="flex gap-12">
      {/* Article */}
      <article className="min-w-0 flex-1">
        <header className="mb-8">
          <p className="mb-2 text-sm font-medium text-brand-600">{doc.section}</p>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{doc.title}</h1>
          {doc.description && (
            <p className="mt-3 text-lg text-muted-foreground">{doc.description}</p>
          )}
        </header>

        <div className="prose prose-slate max-w-none">
          <MDXContent content={doc.content} />
        </div>

        <DocsPrevNext
          prev={prev ? { title: prev.title, href: prev.href } : undefined}
          next={next ? { title: next.title, href: next.href } : undefined}
        />
      </article>

      {/* TOC */}
      <aside className="hidden w-52 shrink-0 xl:block">
        <div className="sticky top-20">
          <TableOfContents entries={tocEntries} />
        </div>
      </aside>
    </div>
  );
}
