/**
 * Base error class for all Baton errors
 */
export class BatonError extends Error {
  readonly code: string;
  readonly cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.cause = cause;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown when a manifest file fails validation
 */
export class ManifestValidationError extends BatonError {
  constructor(message: string, cause?: unknown) {
    super("MANIFEST_VALIDATION_ERROR", message, cause);
  }
}

/**
 * Thrown when a Git source operation fails
 */
export class GitSourceError extends BatonError {
  constructor(message: string, cause?: unknown) {
    super("GIT_SOURCE_ERROR", message, cause);
  }
}

/**
 * Thrown when a requested version is not found
 */
export class VersionNotFoundError extends BatonError {
  constructor(message: string, cause?: unknown) {
    super("VERSION_NOT_FOUND_ERROR", message, cause);
  }
}

/**
 * Thrown when an adapter is not found for a given agent key
 */
export class AdapterNotFoundError extends BatonError {
  constructor(message: string, cause?: unknown) {
    super("ADAPTER_NOT_FOUND_ERROR", message, cause);
  }
}

/**
 * Thrown when a source string cannot be parsed
 */
export class SourceParseError extends BatonError {
  constructor(message: string, cause?: unknown) {
    super("SOURCE_PARSE_ERROR", message, cause);
  }
}

/**
 * Thrown when circular inheritance is detected in profile extends chain
 */
export class CircularInheritanceError extends BatonError {
  constructor(message: string, cause?: unknown) {
    super("CIRCULAR_INHERITANCE_ERROR", message, cause);
  }
}

/**
 * Thrown when a file is not found
 */
export class FileNotFoundError extends BatonError {
  constructor(message: string, cause?: unknown) {
    super("FILE_NOT_FOUND_ERROR", message, cause);
  }
}

/**
 * Thrown when a source is not found
 */
export class SourceNotFoundError extends BatonError {
  constructor(message: string, cause?: unknown) {
    super("SOURCE_NOT_FOUND_ERROR", message, cause);
  }
}

/**
 * Thrown when Git is not installed on the system
 */
export class GitNotInstalledError extends BatonError {
  constructor(message: string, cause?: unknown) {
    super("GIT_NOT_INSTALLED_ERROR", message, cause);
  }
}
