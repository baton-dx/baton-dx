/**
 * Kebab-case validation regex for profile and source names.
 * Must start with a lowercase letter or digit, followed by lowercase letters, digits, or hyphens.
 * No consecutive hyphens, no leading/trailing hyphens.
 */
export const KEBAB_CASE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Simple semver validation regex (major.minor.patch).
 */
export const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;
