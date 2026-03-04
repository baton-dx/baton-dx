import { CommandTabs } from "./CommandTabs";

const installTabs = [
  { label: "bun", command: "bun add -g @baton-dx/cli" },
  { label: "pnpm", command: "pnpm add -g @baton-dx/cli" },
  { label: "npm", command: "npm install -g @baton-dx/cli" },
  { label: "yarn", command: "yarn global add @baton-dx/cli" },
  { label: "Homebrew", command: "brew install baton-dx" },
];

export function InstallTabs() {
  return <CommandTabs tabs={installTabs} />;
}
