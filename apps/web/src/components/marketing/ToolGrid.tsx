const tools = [
  { name: "Claude Code", alias: "claude", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { name: "Cursor", alias: "cursor", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { name: "GitHub Copilot", alias: "copilot", color: "bg-gray-50 text-gray-700 border-gray-200" },
  { name: "Windsurf", alias: "windsurf", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { name: "Zed", alias: "zed", color: "bg-purple-50 text-purple-700 border-purple-200" },
  { name: "Gemini CLI", alias: "gemini", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { name: "Aider", alias: "aider", color: "bg-green-50 text-green-700 border-green-200" },
  { name: "Codex CLI", alias: "codex", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { name: "Amp", alias: "amp", color: "bg-pink-50 text-pink-700 border-pink-200" },
  { name: "Cline", alias: "cline", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { name: "Kilo Code", alias: "kilocode", color: "bg-teal-50 text-teal-700 border-teal-200" },
  { name: "Roo Code", alias: "roocode", color: "bg-rose-50 text-rose-700 border-rose-200" },
  { name: "Continue", alias: "continue", color: "bg-violet-50 text-violet-700 border-violet-200" },
  { name: "Goose", alias: "goose", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
];

export function ToolGrid() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Supports 14 AI Coding Tools
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            One config manager, every tool your team uses.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {tools.map((tool) => (
            <div
              key={tool.alias}
              className={`flex items-center justify-center rounded-lg border px-3 py-3 text-center text-sm font-medium ${tool.color} transition-transform hover:scale-105`}
            >
              {tool.name}
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          More tools added regularly.{" "}
          <a
            href="https://github.com/baton-dx/baton-dx/issues"
            className="text-brand-600 underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Request a tool →
          </a>
        </p>
      </div>
    </section>
  );
}
