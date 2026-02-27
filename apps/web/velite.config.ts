import { defineConfig, defineCollection, s } from "velite";

const docs = defineCollection({
  name: "Doc",
  pattern: "docs/**/*.mdx",
  schema: s
    .object({
      title: s.string(),
      description: s.string().optional(),
      order: s.number().default(99),
      section: s.string().default("Reference"),
      content: s.raw(),
      toc: s.toc(),
    })
    .transform((data, ctx) => {
      const slug = ctx.meta.path
        .replace(/^docs\//, "")
        .replace(/\.mdx$/, "");
      return {
        ...data,
        slug,
        href: `/docs/${slug}`,
      };
    }),
});

export default defineConfig({
  root: "content",
  output: {
    data: ".velite",
    assets: "public/static",
    base: "/static/",
    name: "[name]-[hash:6].[ext]",
    clean: true,
  },
  collections: { docs },
});
