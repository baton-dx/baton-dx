export { loadLockfile, loadProfileManifest, loadProjectManifest } from "./yaml-parser.js";
export { parseSource, type ParsedSource } from "./source-parser.js";
export { parseFrontmatter, type ParsedFrontmatter } from "./frontmatter.js";
export {
  collectComprehensivePatterns,
  ensureBatonDirGitignored,
  removeGitignoreManagedSection,
  updateGitignore,
  type CollectComprehensivePatternsOptions,
} from "./gitignore.js";
export {
  resolveProfilesConcurrently,
  fetchManifestsConcurrently,
  type ProfileResolutionResult,
} from "./concurrent-fetch.js";
