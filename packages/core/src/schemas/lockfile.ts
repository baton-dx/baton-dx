import { z } from "zod";

// Schema for file metadata in lockfile integrity entries
// Each placed file is annotated with its SHA-256 hash, the tool it belongs to, and its category
const fileMetadataSchema = z.object({
  hash: z.string().describe("SHA-256 hash of the file content"),
  tool: z.string().optional().describe("Tool key this file belongs to (e.g., 'claude-code')"),
  category: z.enum(["ai", "ide", "files"]).optional().describe("Category of the placed file"),
});

// Backward-compatible integrity entry: accepts either a plain hash string or a metadata object
// Plain strings are transformed to { hash: string } for uniform access
const integrityEntrySchema = z.union([
  z.string().transform((hash) => ({ hash, tool: undefined, category: undefined })),
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
  integrity: integritySchema.describe("File metadata with SHA-256 hashes and tool annotations"),
});

// Schema for the complete lockfile
export const lockfileSchema = z.object({
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
