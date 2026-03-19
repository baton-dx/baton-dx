export const PACKAGE_NAME = "@baton-dx/core";

// Re-export types from ai-tool-paths (to maintain backward compatibility)
export type { ConfigType, Scope } from "@baton-dx/ai-tool-paths";
export { AIToolNotFoundError } from "@baton-dx/ai-tool-paths";
export { AmpAdapter } from "./adapters/amp.js";
export { AntigravityAdapter } from "./adapters/antigravity.js";
// Export base adapter
export { BaseAIToolAdapter } from "./adapters/base-adapter.js";
// Export adapters
export { ClaudeCodeAdapter } from "./adapters/claude-code.js";
export { ClineAdapter } from "./adapters/cline.js";
export { CodexAdapter } from "./adapters/codex.js";
export { CursorAdapter } from "./adapters/cursor.js";
export { GitHubCopilotAdapter } from "./adapters/github-copilot.js";
export { JunieAdapter } from "./adapters/junie.js";
export { KiroAdapter } from "./adapters/kiro.js";
export { OpenCodeAdapter } from "./adapters/opencode.js";
// Export adapter registry
export {
    getAIToolAdapter,
    getAIToolAdaptersForKeys,
    getAllAIToolAdapters,
} from "./adapters/registry.js";
export { RooAdapter } from "./adapters/roo.js";
export { TraeAdapter } from "./adapters/trae.js";
// Export adapter types and type guards
export type {
    AgentFile,
    AIToolAdapter,
    CommandFile,
    McpCapabilities,
    McpConfigFormat,
    McpEnvVarSyntax,
    MemoryFile,
    MergedMcpServer,
    RuleFile,
    SkillDir,
    ToolMcpServer,
    ValidationResult,
} from "./adapters/types.js";
export {
    isAgentFile,
    isCommandFile,
    isMemoryFile,
    isRuleFile,
    isSkillDir,
} from "./adapters/types.js";
export { WindsurfAdapter } from "./adapters/windsurf.js";
export { ZedAdapter } from "./adapters/zed.js";
// Export first-run detection
export { isFirstRun } from "./config/first-run.js";
// Export global config management
export {
    addGlobalSource,
    getBatonHome,
    getDefaultGlobalSource,
    getGlobalAiTools,
    getGlobalConfigPath,
    getGlobalIdePlatforms,
    getGlobalSources,
    loadGlobalConfig,
    removeGlobalSource,
    saveGlobalConfig,
    setGlobalAiTools,
    setGlobalIdePlatforms,
} from "./config/global-config.js";
// Export AI tool detection
export {
    clearAIToolCache,
    detectInstalledAITools,
    setDetectedAITools,
} from "./detection/ai-tool-detection.js";
// Export directive processing
export {
    type DirectiveContext,
    type DirectiveOptions,
    processDirectives,
} from "./directives/index.js";
export { computePlacementTarget } from "./directives/placement.js";
export type { FilePlacement } from "./directives/types.js";
// Export filesystem discovery (convention-over-configuration)
export {
    type AssembledContent,
    assembleContentFromDiscovery,
    type CommandEntry,
    type DiscoveryInput,
    type DiscoveryProfileMeta,
    discoverProfile,
    type FileEntry,
    type IdeEntry,
    type ProfileDiscoveryResult,
} from "./discovery/index.js";
// Export all error classes
export {
    AIToolAdapterNotFoundError,
    BatonError,
    CircularInheritanceError,
    FileNotFoundError,
    GitAuthenticationError,
    GitNotInstalledError,
    GitSourceError,
    ManifestValidationError,
    SourceNotFoundError,
    SourceParseError,
    VersionNotFoundError,
} from "./errors.js";
// Export frontmatter parser
export {
    BATON_OWNED_KEYS,
    type BatonOwnedKey,
    type ParsedFrontmatter as BatonParsedFrontmatter,
    parseFrontmatter as parseBatonFrontmatter,
} from "./frontmatter/index.js";
// Export IDE detection
export {
    clearIdeCache,
    detectInstalledIdes,
    setDetectedIdes,
} from "./ide/detection.js";
// Export IDE platform registry
export {
    getIdePlatformTargetDir,
    getRegisteredIdePlatforms,
    type IdePlatformEntry,
    idePlatformRegistry,
    isKnownIdePlatform,
} from "./ide/platform-registry.js";
// Export profile inheritance
export {
    type CloneContext,
    type ResolvedProfile,
    resolveProfileChain,
} from "./inheritance/profile-chain.js";
// Export profile support resolution (source → profile inheritance)
export {
    type ResolvedProfileSupport,
    resolveProfileSupport,
    type SourceManifest,
} from "./inheritance/profile-support.js";
// Export intersection computation
export {
    computeIntersection,
    type DeveloperTools,
    type DimensionIntersection,
    type IntersectionResult,
} from "./intersection/compute.js";
// Export lockfile cleanup
export { removePlacedFiles } from "./lockfile/cleanup.js";
// Export lockfile management
export {
    compareLock,
    generateLock,
    type LockFileEntry,
    readLock,
    writeLock,
} from "./lockfile/manager.js";
export { checkLockfileVersion, checkSourceBatonRequires } from "./lockfile/version-check.js";
// Export MCP env-transform utility
export { transformEnvVars } from "./mcp/env-transform.js";
export type { SharedSettingsResult } from "./mcp/shared-settings.js";
// Export MCP shared-settings utility
export { readModifyWriteSharedSettings } from "./mcp/shared-settings.js";
// Export MCP writer utilities
export { writeMcpJson, writeMcpJsonc, writeMcpToml } from "./mcp/writer.js";
// Export agent types
export type { AgentEntry } from "./merge/agents.js";
// Export content parts merge
export {
    mergeContentParts,
    normalizeMarkdown,
} from "./merge/content-parts.js";
// Export MCP merge logic
export {
    type MergeMcpResult,
    mergeMcp,
    mergeMcpWithWarnings,
} from "./merge/mcp.js";
// Export memory types
export type {
    MemoryContribution,
    MemoryEntry,
} from "./merge/memory.js";
// Export rule types
export type { RuleEntry } from "./merge/rules.js";
// Export scope resolution
export { resolveScope } from "./merge/scope-resolution.js";
// Export skill types
export type { MergedSkillItem } from "./merge/skills.js";
// Export weight-based profile sorting
export {
    getProfileWeight,
    isLockedProfile,
    sortProfilesByWeight,
    WEIGHT_LOCK,
    type WeightConflictWarning,
} from "./merge/weight-sort.js";
// Export legacy path migration
export {
    detectLegacyPaths,
    getConservativeAction,
    type LegacyFile,
    type MigrationAction,
    type MigrationResult,
    migrateCommonLegacyPaths,
    migrateLegacyFile,
} from "./migration/legacy-paths.js";
// Export placement engine
export {
    clearCanonicalCache,
    type PlacementConfig,
    type PlacementMode,
    type PlacementResult,
    placeFile,
} from "./placement/engine.js";
// Export project preferences
export {
    deleteProjectPreferences,
    getPreferencesPath,
    type ProjectPreferences,
    projectPreferencesSchema,
    type ResolvedPreferences,
    readProjectPreferences,
    resolvePreferences,
    writeProjectPreferences,
} from "./preferences/index.js";
export type { GlobalSourceEntry } from "./schemas/global-config.js";
// Export types used by CLI
export type {
    FileMetadata,
    LockFile,
    LockfileConfigType,
} from "./schemas/lockfile.js";
export { lockfileSchema } from "./schemas/lockfile.js";
export type {
    McpServer,
    McpTransport,
} from "./schemas/profile-manifest.js";
// Export schemas (only those used externally)
export {
    detectLegacyFields,
    detectV1Fields,
    KEBAB_CASE_REGEX,
    mcpServerSchema,
    profileManifestSchema,
} from "./schemas/profile-manifest.js";
export type { ProjectManifest } from "./schemas/project-manifest.js";
export { projectManifestSchema } from "./schemas/project-manifest.js";
export {
    detectLegacySourceFields,
    sourceManifestSchema,
    weightSchema,
} from "./schemas/source-manifest.js";
// Export self-update utilities
export {
    checkLatestVersion,
    detectInstallMethod,
    formatInstallCommand,
    type InstallMethod,
    isUpdateAvailable,
    type LatestVersionResult,
    type UpdateCheckResult,
} from "./self-update/index.js";
// Export auth cascade
export {
    type AuthDiagnosticStep,
    type AuthLogger,
    type AuthMethod,
    type AuthOptions,
    type AuthResult,
    clearAuthCache,
    getAuthSetupInstructions,
    resolveAuth,
    runAuthDiagnostic,
} from "./sources/auth-cascade.js";
// Export batch source resolver
export {
    type BatchResolveOptions,
    type BatchResolveResult,
    findLockedPackageBySource,
    type ResolvedSourceEntry,
    resolveSourcesBatch,
    type SourceError,
    VersionRequirementError,
} from "./sources/batch-resolver.js";
// Export File resolver
export {
    type FileResolverOptions,
    type ResolvedFilePath,
    resolveFileSource,
} from "./sources/file-resolver.js";
// Export Git source provider
export {
    type ClonedSource,
    type CloneOptions,
    cloneGitSource,
    expandSparseCheckout,
} from "./sources/git-clone.js";
// Export Git utilities
export {
    createGit,
    createInteractiveGit,
    isAuthError,
    redactUrl,
    withTokenAuth,
} from "./sources/git-utils.js";
// Export GitHub resolver
export {
    type GitHubResolverOptions,
    getAuthenticatedUrl,
    type ResolvedGitHubSource,
    resolveGitHubSource,
} from "./sources/github-resolver.js";
// Export local source loader
export {
    type LoadLocalSourceOptions,
    type LocalSource,
    loadLocalSource,
    resolveLocalPath,
} from "./sources/local-source.js";
// Export NPM resolver
export {
    type NpmCacheMeta,
    type NpmResolverOptions,
    type PackageManager,
    type ResolvedNpmSource,
    resolveNpmSource,
} from "./sources/npm-resolver.js";
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
// Export version resolver
export { resolveVersion } from "./sources/version-resolver.js";
// Export stale detection
export { checkStale, type StaleCheckResult } from "./stale/index.js";
// Export local placement state
export {
    flattenPlacedFiles,
    getStatePath,
    type PlacementState,
    placementStateSchema,
    readState,
    writeState,
} from "./state/index.js";
// Export variable substitution
export {
    isBinaryFile,
    processFileContent,
    type SubstitutionOptions,
    substituteVariables,
    type VariableSources,
} from "./substitution/variables.js";
// Export utility functions
export {
    atomicWriteFile,
    collectAiToolPatterns,
    collectComprehensivePatterns,
    collectFilePatterns,
    collectIdePatterns,
    ensureBatonDirGitignored,
    expandLocalPath,
    type GitignoreConfig,
    type GitignoreSection,
    loadLockfile,
    loadProfileManifest,
    loadProjectManifest,
    type ParsedFrontmatter,
    type ParsedSource,
    parseFrontmatter,
    parseGitignoreConfig,
    parseSource,
    removeGitignoreManagedSection,
    updateGitignore,
    updateGitignoreWithSections,
} from "./utils/index.js";
export type {
    ValidationIssue,
    ValidationReport,
    ValidationSeverity,
    ValidationSummary,
} from "./validation/index.js";
// Export source validation
export { validateSource } from "./validation/index.js";
