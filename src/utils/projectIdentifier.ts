/**
 * Smart project identifier handling utilities
 * Handles both numeric IDs and namespace paths (URL-encoded or not)
 */

/**
 * Smart project identifier that can be numeric ID or namespace path
 */
export interface ProjectIdentifier {
  /** The normalized project identifier for API calls */
  identifier: string;
  /** Whether this is a numeric ID (true) or namespace path (false) */
  isNumericId: boolean;
  /** Original input value */
  originalValue: string;
}

/**
 * Detects if a string is URL-encoded by checking for common encoded characters
 */
function isUrlEncoded(str: string): boolean {
  // Check for common URL encoded patterns: %20, %2F, %3A, etc.
  return /%[0-9A-Fa-f]{2}/.test(str);
}

/**
 * Detects if a string is a numeric ID
 */
function isNumericId(str: string): boolean {
  return /^\d+$/.test(str.trim());
}

/**
 * Smart processing of project identifier that handles:
 * - Numeric IDs: "123" -> stays as "123"
 * - URL-encoded paths: "group%2Fproject" -> stays as "group%2Fproject" (for API)
 * - Regular paths: "group/project" -> converts to "group%2Fproject"
 * - Already properly encoded paths: detected and preserved
 */
export function processProjectIdentifier(input: string): ProjectIdentifier {
  const trimmedInput = input.trim();

  // Check if it's a numeric ID
  if (isNumericId(trimmedInput)) {
    return {
      identifier: trimmedInput,
      isNumericId: true,
      originalValue: input,
    };
  }

  // For namespace paths, we need to ensure proper encoding for GitLab API
  let identifier: string;

  if (isUrlEncoded(trimmedInput)) {
    // Already URL-encoded, use as-is (avoid double encoding)
    identifier = trimmedInput;
  } else {
    // Regular path, needs URL encoding
    identifier = encodeURIComponent(trimmedInput);
  }

  return {
    identifier,
    isNumericId: false,
    originalValue: input,
  };
}

/**
 * Safe URL component encoding that avoids double-encoding
 * If input is already encoded, returns as-is
 * If input needs encoding, applies encodeURIComponent
 */
export function safeEncodeProjectId(projectId: string): string {
  const processed = processProjectIdentifier(projectId);
  return processed.identifier;
}

/**
 * Normalize project identifier for API calls
 * Ensures the identifier is properly formatted for GitLab REST API
 */
export function normalizeProjectId(projectId: string): string {
  return safeEncodeProjectId(projectId);
}

/**
 * Validate project identifier format
 * Returns error message if invalid, null if valid
 */
export function validateProjectIdentifier(input: string): string | null {
  if (!input || typeof input !== "string") {
    return "Project identifier is required and must be a string";
  }

  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return "Project identifier cannot be empty";
  }

  // Check if it's numeric ID
  if (isNumericId(trimmed)) {
    return null; // Valid numeric ID
  }

  // Check if it's a valid namespace path (with or without encoding)
  const decoded = isUrlEncoded(trimmed) ? decodeURIComponent(trimmed) : trimmed;

  // Basic validation for namespace/project format
  if (!/^[a-zA-Z0-9\-_./]+$/.test(decoded)) {
    return "Invalid project identifier format. Use numeric ID or namespace/project path.";
  }

  return null; // Valid
}
