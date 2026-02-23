/**
 * Severity level for validation issues
 */
export type ValidationSeverity = "error" | "warning";

/**
 * A single validation issue found during source validation
 */
export interface ValidationIssue {
  /** Whether this is a blocking error or an advisory warning */
  severity: ValidationSeverity;
  /** Human-readable description of the issue */
  message: string;
  /** File or directory path related to the issue (relative to source root) */
  path?: string;
  /** Context identifier, e.g. "profile:default", "source-manifest" */
  context?: string;
}

/**
 * Summary statistics for a validation run
 */
export interface ValidationSummary {
  errors: number;
  warnings: number;
  profilesChecked: number;
}

/**
 * Complete validation report for a source repository
 */
export interface ValidationReport {
  /** true if no errors were found (warnings are acceptable) */
  valid: boolean;
  /** All issues found during validation */
  issues: ValidationIssue[];
  /** Summary statistics */
  summary: ValidationSummary;
}
