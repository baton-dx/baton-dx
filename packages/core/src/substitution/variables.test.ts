import { afterEach, describe, expect, test } from "vitest";
import { isBinaryFile, processFileContent, substituteVariables } from "./variables.js";

describe("isBinaryFile", () => {
  test("detects image files", () => {
    expect(isBinaryFile("image.png")).toBe(true);
    expect(isBinaryFile("photo.jpg")).toBe(true);
    expect(isBinaryFile("icon.ico")).toBe(true);
  });

  test("detects archive files", () => {
    expect(isBinaryFile("archive.zip")).toBe(true);
    expect(isBinaryFile("tarball.tar.gz")).toBe(true);
  });

  test("detects font files", () => {
    expect(isBinaryFile("font.woff2")).toBe(true);
    expect(isBinaryFile("font.ttf")).toBe(true);
  });

  test("does not detect text files as binary", () => {
    expect(isBinaryFile("README.md")).toBe(false);
    expect(isBinaryFile("config.yaml")).toBe(false);
    expect(isBinaryFile("script.js")).toBe(false);
  });

  test("handles case-insensitive extensions", () => {
    expect(isBinaryFile("IMAGE.PNG")).toBe(true);
    expect(isBinaryFile("file.PDF")).toBe(true);
  });
});

describe("substituteVariables", () => {
  afterEach(() => {
    // Clean up any registered Handlebars helpers
    // @ts-ignore - accessing private API for cleanup
    if (typeof Handlebars !== "undefined" && Handlebars.helpers) {
      // biome-ignore lint/performance/noDelete: Handlebars cleanup requires delete
      delete Handlebars.helpers.helperMissing;
    }
  });

  test("replaces single variable", () => {
    const content = "Hello {{name}}!";
    const result = substituteVariables(content, {
      sources: { manifest: { name: "World" } },
    });
    expect(result).toBe("Hello World!");
  });

  test("replaces multiple variables", () => {
    const content = "{{greeting}} {{name}}!";
    const result = substituteVariables(content, {
      sources: { manifest: { greeting: "Hello", name: "Baton" } },
    });
    expect(result).toBe("Hello Baton!");
  });

  test("preserves undefined variables", () => {
    const content = "Hello {{name}}!";
    const result = substituteVariables(content, {
      sources: { manifest: {} },
      warnOnUndefined: false,
    });
    expect(result).toBe("Hello {{name}}!");
  });

  test("calls onWarning for undefined variables", () => {
    const warnings: string[] = [];
    const content = "Hello {{name}}!";

    substituteVariables(content, {
      sources: { manifest: {} },
      onWarning: (msg) => warnings.push(msg),
    });

    expect(warnings).toContain("Variable {{name}} is undefined and was left as-is");
  });

  test("respects variable source priority: manifest > cli > env", () => {
    const content = "{{var1}} {{var2}} {{var3}}";
    const result = substituteVariables(content, {
      sources: {
        env: { var1: "env1", var2: "env2", var3: "env3" },
        cli: { var1: "cli1", var2: "cli2" },
        manifest: { var1: "manifest1" },
      },
    });
    expect(result).toBe("manifest1 cli2 env3");
  });

  test("handles nested object access (undefined becomes empty)", () => {
    const content = "Project: {{project.name}}";
    const result = substituteVariables(content, {
      sources: { manifest: { "project.name": "Baton" } },
      warnOnUndefined: false,
    });
    // Handlebars with nested object paths requires actual nested objects
    // With flat keys like "project.name", it won't resolve and returns empty string
    expect(result).toBe("Project: ");
  });

  test("handles empty content", () => {
    const result = substituteVariables("", {
      sources: { manifest: { name: "Test" } },
    });
    expect(result).toBe("");
  });

  test("handles content with no variables", () => {
    const content = "Just plain text";
    const result = substituteVariables(content, {
      sources: { manifest: { name: "Test" } },
    });
    expect(result).toBe("Just plain text");
  });

  test("handles special characters in values", () => {
    const content = "Message: {{msg}}";
    const result = substituteVariables(content, {
      sources: { manifest: { msg: "<script>alert('xss')</script>" } },
    });
    // noEscape: true means no HTML escaping
    expect(result).toBe("Message: <script>alert('xss')</script>");
  });
});

describe("processFileContent", () => {
  afterEach(() => {
    // Clean up any registered Handlebars helpers
    // @ts-ignore - accessing private API for cleanup
    if (typeof Handlebars !== "undefined" && Handlebars.helpers) {
      // biome-ignore lint/performance/noDelete: Handlebars cleanup requires delete
      delete Handlebars.helpers.helperMissing;
    }
  });

  test("processes text files", () => {
    const content = "Name: {{name}}";
    const result = processFileContent(content, "README.md", {
      sources: { manifest: { name: "Baton" } },
    });
    expect(result).toBe("Name: Baton");
  });

  test("skips binary files", () => {
    const content = "Name: {{name}}";
    const result = processFileContent(content, "image.png", {
      sources: { manifest: { name: "Baton" } },
    });
    expect(result).toBe("Name: {{name}}");
  });

  test("processes YAML files", () => {
    const content = "name: {{project_name}}\nversion: {{version}}";
    const result = processFileContent(content, "baton.profile.yaml", {
      sources: { manifest: { project_name: "my-profile", version: "1.0.0" } },
    });
    expect(result).toBe("name: my-profile\nversion: 1.0.0");
  });

  test("processes markdown files", () => {
    const content = "# {{title}}\n\n{{description}}";
    const result = processFileContent(content, "README.md", {
      sources: {
        manifest: { title: "Baton", description: "A package manager for DX" },
      },
    });
    expect(result).toBe("# Baton\n\nA package manager for DX");
  });
});
