import { z } from "zod";

// Canonical config type for lockfile integrity entries
const configTypeEnum = z.enum([
    "skills",
    "rules",
    "agents",
    "memory",
    "commands",
    "files",
    "ide",
    "mcp",
]);

// Schema for file metadata in lockfile integrity entries
// Each entry is annotated with its SHA-256 hash and canonical config type
const fileMetadataSchema = z.object({
    hash: z.string().describe("SHA-256 hash of the source content (before tool transformation)"),
    type: configTypeEnum.optional().describe("Canonical config type (e.g., 'skills', 'memory')"),
    // Legacy fields — kept for backward-compatible reading of old lockfiles
    tool: z.string().optional().describe("(Legacy) Tool key this file belongs to"),
    category: z
        .enum(["ai", "ide", "files"])
        .optional()
        .describe("(Legacy) Category of the placed file"),
});

// Backward-compatible integrity entry: accepts either a plain hash string or a metadata object
// Plain strings are transformed to { hash: string } for uniform access
const integrityEntrySchema = z.union([
    z
        .string()
        .transform((hash) => ({ hash, type: undefined, tool: undefined, category: undefined })),
    fileMetadataSchema,
]);

// Schema for package integrity — maps file paths to their metadata
const integritySchema = z.record(z.string(), integrityEntrySchema);

// Schema for a single locked package entry
const lockedPackageSchema = z.object({
    source: z.string().describe("Original source URL/path"),
    resolved: z.string().describe("Resolved Git URL or filesystem path"),
    version: z.string().describe("Version tag, branch, or commit SHA"),
    sha: z.string().describe("Git commit SHA or filesystem integrity hash"),
    integrity: integritySchema.describe(
        "Canonical file metadata with SHA-256 hashes of source content",
    ),
});

// Schema for the complete lockfile
export const lockfileSchema = z.object({
    baton_version: z
        .string()
        .optional()
        .describe("Baton CLI version that generated this lockfile (semver)"),
    locked_at: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, {
            message: "locked_at must be an ISO 8601 datetime string",
        })
        .describe("ISO 8601 timestamp when lockfile was generated"),
    packages: z
        .record(z.string(), lockedPackageSchema)
        .describe("Locked package data keyed by package name"),
});

// Exported types
export type LockFile = z.infer<typeof lockfileSchema>;
export type LockedPackage = z.infer<typeof lockedPackageSchema>;
export type FileMetadata = z.infer<typeof fileMetadataSchema>;
export type LockfileConfigType = z.infer<typeof configTypeEnum>;
