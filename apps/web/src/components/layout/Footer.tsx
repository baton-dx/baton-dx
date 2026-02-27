import Link from "next/link";

const footerLinks = [
  {
    title: "Product",
    links: [
      { label: "Documentation", href: "https://docs.batondx.dev" },
      { label: "Changelog", href: "https://github.com/batondx/baton-dx/blob/main/CHANGELOG.md" },
      { label: "Marketplace", href: "https://marketplace.batondx.dev" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "GitHub", href: "https://github.com/batondx/baton-dx" },
      { label: "npm Package", href: "https://www.npmjs.com/package/@baton-dx/cli" },
      { label: "Contributing", href: "https://docs.batondx.dev/contributing" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "MIT License", href: "https://github.com/batondx/baton-dx/blob/main/LICENSE" },
      { label: "Code of Conduct", href: "https://github.com/batondx/baton-dx/blob/main/CODE_OF_CONDUCT.md" },
      { label: "Security", href: "https://github.com/batondx/baton-dx/blob/main/SECURITY.md" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-1">
            <p className="text-sm font-semibold text-foreground">Baton DX</p>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              CLI package manager for AI tool configs. Version and sync AI tool
              configurations across your team.
            </p>
          </div>

          {/* Links */}
          {footerLinks.map((group) => (
            <div key={group.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.title}
              </p>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      target={link.href.startsWith("http") ? "_blank" : undefined}
                      rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 border-t border-border pt-8">
          <p className="text-center text-xs text-muted-foreground">
            © 2026 Baton DX. Released under the MIT License.
          </p>
        </div>
      </div>
    </footer>
  );
}
