const MAX_PATTERN_LENGTH = 200;
const NESTED_QUANTIFIER_PATTERN = /(\(.*[+*?].*\)|\[.*\])[+*?]/;

export interface DeniedToolsRegexResult {
  readonly regex: RegExp | undefined;
  readonly error: string | undefined;
}

export function compileDeniedToolsRegex(pattern: string | undefined): DeniedToolsRegexResult {
  if (!pattern) {
    return { regex: undefined, error: undefined };
  }

  if (pattern.length > MAX_PATTERN_LENGTH) {
    return {
      regex: undefined,
      error: `GITLAB_DENIED_TOOLS_REGEX pattern exceeds ${MAX_PATTERN_LENGTH} chars. Ignoring.`,
    };
  }

  if (NESTED_QUANTIFIER_PATTERN.test(pattern)) {
    return {
      regex: undefined,
      error: "GITLAB_DENIED_TOOLS_REGEX contains potentially unsafe nested quantifiers. Ignoring.",
    };
  }

  try {
    // Operator config (CLI flag or env), not a remote request. The checks
    // above bound length and nested quantifiers. main dismissed the same
    // finding on the previous index.ts copy as a false positive.
    // codeql[js/regex-injection]
    const regex = new RegExp(pattern);
    regex.test("sample_tool_name");
    return { regex, error: undefined };
  } catch {
    return {
      regex: undefined,
      error: `Invalid GITLAB_DENIED_TOOLS_REGEX pattern: "${pattern}". Ignoring.`,
    };
  }
}
