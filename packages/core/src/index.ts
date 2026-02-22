export const PACKAGE_NAME = "@baton-dx/core";

// Re-export types from ai-tool-paths (to maintain backward compatibility)
export type { ConfigType, Scope } from "@baton-dx/ai-tool-paths";
export { AIToolNotFoundError } from "@baton-dx/ai-tool-paths";

// Export all error classes
export {
  BatonError,
  ManifestValidationError,
  GitSourceError,
  VersionNotFoundError,
  AIToolAdapterNotFoundError,
  SourceParseError,
  CircularInheritanceError,
  FileNotFoundError,
  SourceNotFoundError,
  GitNotInstalledError,
} from "./errors.js";

// Export schemas (only those used externally)
export { profileManifestSchema, KEBAB_CASE_REGEX } from "./schemas/profile-manifest.js";
export { sourceManifestSchema, weightSchema } from "./schemas/source-manifest.js";

export { projectManifestSchema } from "./schemas/project-manifest.js";

export { lockfileSchema } from "./schemas/lockfile.js";

// Export types used by CLI
export type { FileMetadata, LockFile } from "./schemas/lockfile.js";

export type { ProjectManifest } from "./schemas/project-manifest.js";

// Export utility functions
export {
  loadLockfile,
  loadProfileManifest,
  loadProjectManifest,
  parseSource,
  parseFrontmatter,
  collectComprehensivePatterns,
  ensureBatonDirGitignored,
  removeGitignoreManagedSection,
  updateGitignore,
  type ParsedSource,
  type ParsedFrontmatter,
  type CollectComprehensivePatternsOptions,
} from "./utils/index.js";

// Export Git source provider
export {
  cloneGitSource,
  invalidateCache,
  type CloneOptions,
  type ClonedSource,
} from "./sources/git-clone.js";

// Export GitHub resolver
export {
  resolveGitHubSource,
  type GitHubResolverOptions,
  type ResolvedGitHubSource,
} from "./sources/github-resolver.js";

// Export File resolver
export {
  resolveFileSource,
  type FileResolverOptions,
  type ResolvedFilePath,
} from "./sources/file-resolver.js";

// Export NPM resolver
export {
  resolveNpmSource,
  type NpmResolverOptions,
  type ResolvedNpmSource,
  type PackageManager,
} from "./sources/npm-resolver.js";

// Export version resolver
export { resolveVersion } from "./sources/version-resolver.js";

// Export lockfile management
export {
  generateLock,
  writeLock,
  readLock,
  compareLock,
  type LockFileEntry,
} from "./lockfile/manager.js";

// Export lockfile cleanup
export { removePlacedFiles } from "./lockfile/cleanup.js";

// Export local source loader
export {
  loadLocalSource,
  resolveLocalPath,
  type LoadLocalSourceOptions,
  type LocalSource,
} from "./sources/local-source.js";

// Export profile discovery
export {
  discoverProfiles,
  type ProfileInfo,
} from "./sources/profile-discovery.js";

// Export source repository discovery
export {
  discoverProfilesInSourceRepo,
  findSourceManifest,
  isSourceRepository,
  type SourceProfileInfo,
} from "./sources/source-discovery.js";

// Export adapter types and type guards
export type {
  AIToolAdapter,
  ValidationResult,
  SkillDir,
  RuleFile,
  AgentFile,
  MemoryFile,
  CommandFile,
} from "./adapters/types.js";
export {
  isSkillDir,
  isRuleFile,
  isAgentFile,
  isMemoryFile,
  isCommandFile,
} from "./adapters/types.js";

// Export base adapter
export { BaseAIToolAdapter } from "./adapters/base-adapter.js";

// Export AI tool detection
export {
  detectInstalledAITools,
  clearAIToolCache,
  setDetectedAITools,
} from "./detection/ai-tool-detection.js";

// Export adapters
export { ClaudeCodeAdapter } from "./adapters/claude-code.js";
export { CursorAdapter } from "./adapters/cursor.js";
export { WindsurfAdapter } from "./adapters/windsurf.js";
export { CodexAdapter } from "./adapters/codex.js";
export { AntigravityAdapter } from "./adapters/antigravity.js";
export { GitHubCopilotAdapter } from "./adapters/github-copilot.js";
export { OpenCodeAdapter } from "./adapters/opencode.js";
export { AmpAdapter } from "./adapters/amp.js";
export { KiroAdapter } from "./adapters/kiro.js";
export { ZedAdapter } from "./adapters/zed.js";
export { ClineAdapter } from "./adapters/cline.js";
export { RooAdapter } from "./adapters/roo.js";
export { JunieAdapter } from "./adapters/junie.js";
export { TraeAdapter } from "./adapters/trae.js";

// Export adapter registry
export {
  getAIToolAdapter,
  getAllAIToolAdapters,
  getAIToolAdaptersForKeys,
} from "./adapters/registry.js";

// Export placement engine
export {
  placeFile,
  clearCanonicalCache,
  type PlacementMode,
  type PlacementConfig,
  type PlacementResult,
} from "./placement/engine.js";

// Export legacy path migration
export {
  detectLegacyPaths,
  migrateLegacyFile,
  getConservativeAction,
  migrateCommonLegacyPaths,
  type LegacyFile,
  type MigrationAction,
  type MigrationResult,
} from "./migration/legacy-paths.js";

// Export profile inheritance
export {
  resolveProfileChain,
  type ResolvedProfile,
} from "./inheritance/profile-chain.js";

// Export profile support resolution (source → profile inheritance)
export {
  resolveProfileSupport,
  type ResolvedProfileSupport,
  type SourceManifest,
} from "./inheritance/profile-support.js";

// Export merge strategies
export {
  mergeReplace,
  mergeDeep,
  mergeAppend,
  mergePrepend,
  mergeSkip,
  mergePrompt,
  mergeDirectory,
  mergeImport,
} from "./merge/strategies.js";

// Export content parts merge
export { mergeContentParts } from "./merge/content-parts.js";

// Export skill merge logic
export {
  mergeSkills,
  mergeSkillsWithWarnings,
  type MergedSkillItem,
  type MergeSkillsResult,
} from "./merge/skills.js";

// Export rule merge logic
export {
  mergeRules,
  mergeRulesWithWarnings,
  type RuleEntry,
  type MergeRulesResult,
} from "./merge/rules.js";

// Export agent merge logic
export {
  mergeAgents,
  mergeAgentsWithWarnings,
  type AgentEntry,
  type MergeAgentsResult,
} from "./merge/agents.js";

// Export memory merge logic
export {
  mergeMemory,
  mergeMemoryWithWarnings,
  type MemoryEntry,
  type MemoryContribution,
  type MergeMemoryResult,
} from "./merge/memory.js";

// Export weight-based profile sorting
export {
  sortProfilesByWeight,
  getProfileWeight,
  isLockedProfile,
  WEIGHT_LOCK,
  type WeightConflictWarning,
} from "./merge/weight-sort.js";

// Export variable substitution
export {
  substituteVariables,
  processFileContent,
  isBinaryFile,
  type VariableSources,
  type SubstitutionOptions,
} from "./substitution/variables.js";

// Export global config management
export {
  loadGlobalConfig,
  saveGlobalConfig,
  addGlobalSource,
  removeGlobalSource,
  getGlobalSources,
  getDefaultGlobalSource,
  getBatonHome,
  getGlobalConfigPath,
  getGlobalAiTools,
  setGlobalAiTools,
  addGlobalAiTool,
  removeGlobalAiTool,
  getGlobalIdePlatforms,
  setGlobalIdePlatforms,
  addGlobalIdePlatform,
  removeGlobalIdePlatform,
} from "./config/global-config.js";

export type { GlobalSourceEntry } from "./schemas/global-config.js";

// Export IDE platform registry
export {
  idePlatformRegistry,
  getIdePlatformTargetDir,
  isKnownIdePlatform,
  getRegisteredIdePlatforms,
  type IdePlatformEntry,
} from "./ide/platform-registry.js";

// Export IDE detection
export {
  detectInstalledIdes,
  clearIdeCache,
  setDetectedIdes,
} from "./ide/detection.js";

// Export intersection computation
export {
  computeIntersection,
  type DeveloperTools,
  type DimensionIntersection,
  type IntersectionResult,
} from "./intersection/compute.js";

// Export project preferences
export {
  projectPreferencesSchema,
  type ProjectPreferences,
  getPreferencesPath,
  readProjectPreferences,
  writeProjectPreferences,
  deleteProjectPreferences,
  resolvePreferences,
  type ResolvedPreferences,
} from "./preferences/index.js";
