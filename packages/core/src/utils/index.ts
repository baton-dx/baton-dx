export { loadLockfile, loadProfileManifest, loadProjectManifest } from "./yaml-parser.js";
export { parseSource, type ParsedSource } from "./source-parser.js";
export { parseFrontmatter, type ParsedFrontmatter } from "./frontmatter.js";
export {
  collectComprehensivePatterns,
  ensureBatonDirGitignored,
  removeGitignoreManagedSection,
  updateGitignore,
} from "./gitignore.js";
