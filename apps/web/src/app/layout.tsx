import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TranslationProvider } from "@mantaray0/i18n";
import "./globals.css";
import en from "@/i18n/en.json";

export const metadata: Metadata = {
  title: {
    default: "Baton DX — AI Config Manager",
    template: "%s | Baton DX",
  },
  description:
    "CLI package manager for Developer Experience & AI configuration. Manage skills, rules, agents, and memory files across 14 AI coding tools.",
  keywords: ["AI tools", "CLI", "config management", "Claude", "Cursor", "Copilot", "developer experience"],
  openGraph: {
    type: "website",
    siteName: "Baton DX",
  },
};

const translations = { en };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <TranslationProvider translations={translations} locale="en">
          {children}
        </TranslationProvider>
      </body>
    </html>
  );
}
