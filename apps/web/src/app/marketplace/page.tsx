"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function MarketplacePage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (email.trim()) {
      setSubmitted(true);
    }
  }

  return (
    <section className="flex min-h-[calc(100vh-14rem)] items-center justify-center py-20">
      <div className="mx-auto max-w-2xl px-4 text-center">
        {/* Logo area */}
        <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-600 shadow-lg">
          <MarketplaceIcon className="h-8 w-8 text-white" />
        </div>

        <Badge variant="secondary" className="mb-4">
          Coming Soon
        </Badge>

        <h1 className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Baton Marketplace
        </h1>

        <p className="mt-5 text-xl text-muted-foreground leading-relaxed">
          Discover and share Baton profiles from the community. Find ready-made AI tool
          configurations for your workflow — one click to add to your project.
        </p>

        {/* Features preview */}
        <div className="mt-10 grid gap-4 text-left sm:grid-cols-3">
          {[
            {
              icon: "📦",
              title: "Community Profiles",
              desc: "Browse profiles shared by the Baton community",
            },
            {
              icon: "⭐",
              title: "Ratings & Reviews",
              desc: "Find trusted profiles with community feedback",
            },
            {
              icon: "🔌",
              title: "One-Click Install",
              desc: "Add any profile to your project instantly",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-xl border border-border bg-muted/30 p-4"
            >
              <span className="text-2xl">{item.icon}</span>
              <p className="mt-2 text-sm font-medium text-foreground">{item.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Email signup */}
        <div className="mt-12">
          <h2 className="text-lg font-semibold text-foreground">
            Get notified when it launches
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first to know when the Baton DX Marketplace opens.
          </p>

          {submitted ? (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              You&apos;re on the list. We&apos;ll let you know when we launch.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="flex h-10 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
              <Button type="submit" size="default">
                Notify Me
              </Button>
            </form>
          )}
        </div>

        {/* Back link */}
        <p className="mt-8">
          <Link
            href="https://docs.batondx.dev"
            className="text-sm text-brand-600 hover:underline"
          >
            ← Back to Docs
          </Link>
          <span className="mx-3 text-muted-foreground/30">·</span>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            batondx.dev
          </Link>
        </p>
      </div>
    </section>
  );
}

function MarketplaceIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016 2.993 2.993 0 0 0 2.25-1.016 3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z"
      />
    </svg>
  );
}
