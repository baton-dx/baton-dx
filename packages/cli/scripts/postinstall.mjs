/**
 * Postinstall script — runs after npm/pnpm/yarn install.
 * Plain ESM (no TS, no deps) so it works immediately.
 * Writes to stderr so piped installs aren't affected.
 */

const message = `
  baton installed successfully!

  Aliases:  baton · baton-dx · btx

  Get started:
    baton init        Set up Baton in your project
    baton --help      See all commands
`;

process.stderr.write(message);
