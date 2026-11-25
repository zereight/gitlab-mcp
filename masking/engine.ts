import fs from "node:fs";
import path from "node:path";

export type MaskRule =
  | {
      id: string;
      type: "keyword";
      match: string;
      replacement: string;
      caseSensitive?: boolean;
    }
  | {
      id: string;
      type: "regex";
      pattern: string;
      flags?: string;
      replacement: string;
    };

export interface MaskingFile {
  version?: number;
  builtins?: Record<string, { enabled?: boolean; replacement?: string }>;
  rules?: MaskRule[];
}

interface ManagedMaskingReference {
  version: 2;
  mode: "managed";
  policyGroup: string;
}

interface ManagedPolicyBinding {
  gitlabInstance: string;
  projectIds: number[];
  policyGroup: string;
}

interface ManagedPolicyFile {
  version: 1;
  policyGroups: Record<string, MaskingFile>;
  bindings: ManagedPolicyBinding[];
  /** `deny` is the safe default. `builtin` is an explicit compatibility escape hatch. */
  unboundProjectBehavior?: "deny" | "builtin";
}

interface CompiledRule {
  id: string;
  replacement: string;
  expression: RegExp;
  order: number;
}

interface MaskMatch {
  start: number;
  end: number;
  replacement: string;
  order: number;
}

export interface MaskingEngine {
  readonly configPath?: string;
  maskText(text: string): string;
  /**
   * Masks every string in a value. A string in `masked` was masked before: it gets
   * only the rules that depend on where it sits (secret field names and CI variable
   * records), not the text rules again.
   */
  maskValue<T>(value: T, options?: { masked?: ReadonlySet<string> }): T;
  maskToolResult<T extends Record<string, unknown>>(
    result: T,
    options?: { textFormat?: "plain" | "json" }
  ): T;
  maskError(error: unknown): unknown;
}

const BUILTIN_RULES: MaskRule[] = [
  {
    id: "gitlab-token",
    type: "regex",
    // GitLab token prefixes documented at
    // https://docs.gitlab.com/security/token_overview/#token-prefixes
    pattern: "\\bgl(?:pat|rt|ptt|dt|cbt|soat|oas|agent|ft|imt)-[A-Za-z0-9_-]{20,}\\b",
    flags: "g",
    replacement: "[Token masked]",
  },
  {
    id: "ipv4",
    type: "regex",
    pattern: "\\b(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1?\\d?\\d)){3}\\b",
    flags: "g",
    replacement: "[IP address]",
  },
  {
    id: "ipv6",
    type: "regex",
    pattern:
      "(?<![0-9A-Fa-f:])(?:(?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}:){1,7}:|(?:[0-9A-Fa-f]{1,4}:){1,6}:[0-9A-Fa-f]{1,4}|(?:[0-9A-Fa-f]{1,4}:){1,5}(?::[0-9A-Fa-f]{1,4}){1,2}|(?:[0-9A-Fa-f]{1,4}:){1,4}(?::[0-9A-Fa-f]{1,4}){1,3}|(?:[0-9A-Fa-f]{1,4}:){1,3}(?::[0-9A-Fa-f]{1,4}){1,4}|(?:[0-9A-Fa-f]{1,4}:){1,2}(?::[0-9A-Fa-f]{1,4}){1,5}|[0-9A-Fa-f]{1,4}:(?:(?::[0-9A-Fa-f]{1,4}){1,6})|:(?:(?::[0-9A-Fa-f]{1,4}){1,7}|:))(?![0-9A-Fa-f:])",
    flags: "g",
    replacement: "[IP address]",
  },
  {
    id: "jwt",
    type: "regex",
    // Three base64url segments starting with eyJ ({"). Segment lengths are bounded.
    // The lookbehind allows a start only where the base64url run begins. Without
    // it, every eyJ inside a run such as "-eyJ-eyJ-..." rescans up to 8192 chars.
    // Trade-off: an eyJ directly after "-" (e.g. "sess-eyJ...") is no longer a start.
    pattern:
      "(?<![A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{0,8192}\\.[A-Za-z0-9_-]{1,8192}\\.[A-Za-z0-9_-]{1,8192}(?![A-Za-z0-9_-])",
    flags: "g",
    replacement: "[JWT masked]",
  },
  {
    id: "pem-private-key",
    type: "regex",
    // BEGIN/END labels must match. Line breaks may be real or literal \n / \r\n
    // escapes (a key nested in an escaped JSON string), and "/" may be written
    // as the JSON escape \/. The body is PEM base64,
    // Proc-Type / DEK-Info lines, and single dashes. It cannot contain a run of
    // five dashes, which valid PEM bodies never do, so each scan stops at the
    // next header or footer. Without that bound, every BEGIN rescans up to 32768
    // chars through the following headers.
    pattern:
      "-----BEGIN ([A-Z0-9 ]{0,40}PRIVATE KEY)-----(?:\\r?\\n|\\\\r\\\\n|\\\\n)(?:[A-Za-z0-9+/=\\s,.:]|\\\\[rn/]|-(?!----)){1,32768}?-----END \\1-----",
    flags: "g",
    replacement: "[Private key masked]",
  },
  {
    id: "aws-access-key",
    type: "regex",
    // AKIA/ASIA IDs are a fixed 20-char shape. Secret values are only matched
    // on aws_secret_access_key assignments (quoted or unquoted names) to keep
    // false positives low. A JSON-escaped "\/" counts as one secret character.
    // JSON object fields are handled separately.
    pattern:
      "\\b(?:AKIA|ASIA)[A-Z0-9]{16}\\b|\\b(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)[\"']?\\s*[=:]\\s*[\"']?(?:[A-Za-z0-9/+=]|\\\\/){40}(?![A-Za-z0-9/+=]|\\\\/)",
    flags: "g",
    replacement: "[AWS key masked]",
  },
];

const ALLOWED_REGEX_FLAGS = new Set(["g", "i", "m", "s", "u"]);

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  return value;
}

function compileRule(rule: MaskRule, order: number): CompiledRule {
  if (!rule || typeof rule !== "object") throw new Error(`Invalid mask rule at index ${order}`);
  const id = assertString(rule.id, `mask rule ${order}.id`);
  if (!id) throw new Error(`mask rule ${order}.id must not be empty`);
  const replacement = assertString(rule.replacement, `mask rule ${id}.replacement`);
  let source: string;
  let flags: string;
  if (rule.type === "keyword") {
    const match = assertString(rule.match, `mask rule ${id}.match`);
    if (!match) throw new Error(`mask rule ${id}.match must not be empty`);
    source = escapeRegExp(match);
    flags = rule.caseSensitive === false ? "gi" : "g";
  } else if (rule.type === "regex") {
    source = assertString(rule.pattern, `mask rule ${id}.pattern`);
    flags = rule.flags ?? "g";
    if (!flags.includes("g")) flags += "g";
    if ([...flags].some(flag => !ALLOWED_REGEX_FLAGS.has(flag))) {
      throw new Error(`mask rule ${id}.flags contains an unsupported flag`);
    }
    if (source.length === 0) throw new Error(`mask rule ${id}.pattern must not be empty`);
  } else {
    throw new Error(`mask rule ${id}.type must be "keyword" or "regex"`);
  }

  let expression: RegExp;
  try {
    expression = new RegExp(source, flags);
  } catch (error) {
    throw new Error(
      `Invalid regular expression in mask rule ${id}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  // Empty matches can make a rule unexpectedly rewrite every character and are
  // particularly easy to create accidentally with a configurable expression.
  if (expression.test("")) throw new Error(`mask rule ${id} must not match an empty string`);
  return { id, replacement, expression, order };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mergeBuiltinRules(file: MaskingFile | undefined): MaskRule[] {
  const overrides = file?.builtins ?? {};
  return BUILTIN_RULES.flatMap(rule => {
    const override = overrides[rule.id];
    if (override?.enabled === false) return [];
    return [
      {
        ...rule,
        ...(override?.replacement !== undefined ? { replacement: override.replacement } : {}),
      },
    ];
  });
}

function loadFile(configPath: string): MaskingFile | ManagedMaskingReference {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Unable to load masking config ${configPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Masking config ${configPath} must contain a JSON object`);
  }
  if (isManagedReference(parsed)) {
    const value = parsed as Partial<ManagedMaskingReference>;
    if (value.version !== 2 || typeof value.policyGroup !== "string" || !value.policyGroup.trim()) {
      throw new Error(
        `Managed masking config ${configPath} requires version 2 and a non-empty policyGroup`
      );
    }
    return value as ManagedMaskingReference;
  }
  validateMaskingFile(parsed, `Masking config ${configPath}`);
  return parsed;
}

function loadJsonFile(configPath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(
      `Unable to load masking config ${configPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function normalizeGitLabInstance(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid managed masking GitLab instance: ${value}`);
  }
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/api\/v4\/?$/, "").replace(/\/+$/, "")}`;
}

function isManagedReference(value: unknown): value is ManagedMaskingReference {
  return Boolean(
    value && typeof value === "object" && (value as { mode?: unknown }).mode === "managed"
  );
}

function loadManagedPolicyFile(configPath: string): ManagedPolicyFile {
  const parsed = loadJsonFile(configPath);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Managed masking policy file ${configPath} must contain a JSON object`);
  }
  const file = parsed as Partial<ManagedPolicyFile>;
  if (file.version !== 1) throw new Error("Unsupported managed masking policy version");
  if (
    !file.policyGroups ||
    typeof file.policyGroups !== "object" ||
    Array.isArray(file.policyGroups)
  ) {
    throw new Error("Managed masking policy file policyGroups must be an object");
  }
  if (!Array.isArray(file.bindings))
    throw new Error("Managed masking policy file bindings must be an array");
  if (
    file.unboundProjectBehavior !== undefined &&
    file.unboundProjectBehavior !== "deny" &&
    file.unboundProjectBehavior !== "builtin"
  ) {
    throw new Error(
      'Managed masking policy file unboundProjectBehavior must be "deny" or "builtin"'
    );
  }
  for (const [name, policy] of Object.entries(file.policyGroups)) {
    if (!name.trim()) throw new Error("Managed masking policy group names must not be empty");
    validateMaskingFile(policy, `managed masking policy group ${name}`);
  }
  for (const binding of file.bindings) {
    if (
      !binding ||
      typeof binding !== "object" ||
      typeof binding.gitlabInstance !== "string" ||
      typeof binding.policyGroup !== "string" ||
      !Array.isArray(binding.projectIds)
    ) {
      throw new Error("Invalid managed masking policy binding");
    }
    normalizeGitLabInstance(binding.gitlabInstance);
    if (!file.policyGroups[binding.policyGroup]) {
      throw new Error(
        `Managed masking policy binding references unknown group: ${binding.policyGroup}`
      );
    }
    if (binding.projectIds.some(id => !Number.isSafeInteger(id) || id <= 0)) {
      throw new Error("Managed masking policy binding projectIds must be positive integers");
    }
  }
  return file as ManagedPolicyFile;
}

function validateMaskingFile(value: unknown, description: string): asserts value is MaskingFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${description} must contain a JSON object`);
  }
  const file = value as MaskingFile;
  if (file.version !== undefined && file.version !== 1) {
    throw new Error(`Unsupported masking config version: ${String(file.version)}`);
  }
  if (file.rules !== undefined && !Array.isArray(file.rules)) {
    throw new Error(`${description}.rules must be an array`);
  }
}

const AWS_SECRET_FIELD_NAMES = new Set(["aws_secret_access_key", "AWS_SECRET_ACCESS_KEY"]);
const AWS_SECRET_VALUE_PATTERN = /^[A-Za-z0-9/+=]{40}$/;

function applyAwsSecretFieldMask(
  parentKey: string | undefined,
  value: string,
  masked: string,
  replacement: string | undefined
): string {
  if (
    replacement !== undefined &&
    parentKey !== undefined &&
    AWS_SECRET_FIELD_NAMES.has(parentKey) &&
    AWS_SECRET_VALUE_PATTERN.test(value)
  ) {
    return replacement;
  }
  return masked;
}

function readJsonStringToken(token: string): string {
  const parsed: unknown = JSON.parse(token);
  if (typeof parsed !== "string") {
    throw new Error("JSON string token did not decode to a string");
  }
  return parsed;
}

/**
 * GitLab marks CI/CD variables as `masked` or `hidden` (masked and hidden) so
 * their values stay out of job logs and the UI. The variables API still returns
 * the value, so with masking enabled the whole `value` of such a variable
 * object is replaced, whatever it looks like.
 */
export const FLAGGED_CI_VARIABLE_REPLACEMENT = "[Masked CI variable value]";

function isFlaggedGitlabCiVariable(value: object): boolean {
  const record = value as Record<string, unknown>;
  return (
    typeof record.key === "string" &&
    typeof record.value === "string" &&
    (record.masked === true || record.hidden === true)
  );
}

// The literal after a JSON property name, up to the next `,` or `}`.
const JSON_TRUE_VALUE_GAP = /^\s*:\s*true\s*$/;

function readGitlabCiAwsSecretKey(value: object): string | undefined {
  if (!("key" in value)) return undefined;
  const key = value.key;
  if (typeof key !== "string" || !AWS_SECRET_FIELD_NAMES.has(key)) return undefined;
  return key;
}

/**
 * Masks one string value under its field name. maskStrings and the JSON-text
 * path both call this so structured and text output agree for every field.
 */
function maskFieldValue(
  value: string,
  parentKey: string | undefined,
  mask: (text: string, parentKey?: string) => string
): string {
  const masked = mask(value, parentKey);
  return masked !== value && parentKey === "download_url" ? "[Download URL masked]" : masked;
}

function maskStrings(
  value: unknown,
  mask: (text: string, parentKey?: string) => string,
  parentKey?: string
): unknown {
  if (typeof value === "string") return maskFieldValue(value, parentKey, mask);
  if (Array.isArray(value)) return value.map(item => maskStrings(item, mask, parentKey));
  if (value && typeof value === "object") {
    const ciKey = readGitlabCiAwsSecretKey(value);
    const flaggedCiVariable = isFlaggedGitlabCiVariable(value);
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (flaggedCiVariable && key === "value") {
        output[key] = FLAGGED_CI_VARIABLE_REPLACEMENT;
        continue;
      }
      const fieldKey = key === "value" && ciKey !== undefined ? ciKey : key;
      output[key] = maskStrings(item, mask, fieldKey);
    }
    return output;
  }
  return value;
}

// Complete JSON string literals and structural punctuation. Text between these
// matches (numbers, literals, whitespace) is copied through untouched.
const JSON_STRING_OR_STRUCTURE_PATTERN = /"(?:\\.|[^"\\])*"|[{}[\],]/g;

interface JsonScope {
  /** Field name for values directly inside this container. Arrays inherit it. */
  fieldName: string | undefined;
  /** Objects only: true while the next string token is a property name. */
  expectingKey: boolean;
  isObject: boolean;
  /** Identity of the nearest object, used to join GitLab CI `key`/`value` siblings. */
  objectId: number;
}

interface JsonStringValue {
  index: number;
  token: string;
  decoded: string;
  fieldName: string | undefined;
  objectId: number;
  /** True when the string is a property value of an object, not an array element. */
  isObjectProperty: boolean;
}

function maskJsonText(text: string, mask: (text: string, parentKey?: string) => string): string {
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return mask(text);
  } catch {
    return mask(text);
  }
  // Rewrite only JSON string values. Re-serializing the parsed object would
  // change whitespace and lose precision in numeric values from GitLab. The
  // scope stack follows the same rules as maskStrings: an object value takes
  // the property name, an array element inherits the enclosing field name, and
  // leaving a nested container restores the enclosing scope. Collect values
  // first so a GitLab CI `value` is masked even when it appears before `key`.
  const scopes: JsonScope[] = [];
  const stringValues: JsonStringValue[] = [];
  const objectCiKeys = new Map<number, string>();
  // Objects shaped like a GitLab CI variable: a string `key`, and `masked` or
  // `hidden` set to the literal true. Both are collected before any rewrite.
  const objectsWithStringKey = new Set<number>();
  const objectsFlaggedMasked = new Set<number>();
  let nextObjectId = 0;
  let previousTokenEnd = 0;
  for (const match of text.matchAll(JSON_STRING_OR_STRUCTURE_PATTERN)) {
    const token = match[0];
    const index = match.index;
    if (index === undefined) continue;
    const gap = text.slice(previousTokenEnd, index);
    previousTokenEnd = index + token.length;
    const scope: JsonScope | undefined = scopes[scopes.length - 1];
    if (
      (token === "," || token === "}") &&
      scope?.isObject &&
      !scope.expectingKey &&
      (scope.fieldName === "masked" || scope.fieldName === "hidden") &&
      JSON_TRUE_VALUE_GAP.test(gap)
    ) {
      objectsFlaggedMasked.add(scope.objectId);
    }
    if (token === "{") {
      scopes.push({
        isObject: true,
        expectingKey: true,
        fieldName: undefined,
        objectId: nextObjectId,
      });
      nextObjectId += 1;
      continue;
    }
    if (token === "[") {
      scopes.push({
        isObject: false,
        expectingKey: false,
        fieldName: scope?.fieldName,
        objectId: scope?.objectId ?? -1,
      });
      continue;
    }
    if (token === "}" || token === "]") {
      scopes.pop();
      continue;
    }
    if (token === ",") {
      if (scope?.isObject) scope.expectingKey = true;
      continue;
    }
    const decoded = readJsonStringToken(token);
    if (scope?.isObject && scope.expectingKey) {
      scope.fieldName = decoded;
      scope.expectingKey = false;
      continue;
    }
    if (scope?.isObject && scope.fieldName === "key") {
      objectsWithStringKey.add(scope.objectId);
      if (AWS_SECRET_FIELD_NAMES.has(decoded)) objectCiKeys.set(scope.objectId, decoded);
    }
    stringValues.push({
      index,
      token,
      decoded,
      fieldName: scope?.fieldName,
      objectId: scope?.objectId ?? -1,
      isObjectProperty: scope?.isObject === true,
    });
  }
  let output = "";
  let cursor = 0;
  for (const item of stringValues) {
    output += text.slice(cursor, item.index);
    if (
      item.isObjectProperty &&
      item.fieldName === "value" &&
      objectsWithStringKey.has(item.objectId) &&
      objectsFlaggedMasked.has(item.objectId)
    ) {
      output += JSON.stringify(FLAGGED_CI_VARIABLE_REPLACEMENT);
      cursor = item.index + item.token.length;
      continue;
    }
    const ciKey = objectCiKeys.get(item.objectId);
    const parentKey = item.fieldName === "value" && ciKey !== undefined ? ciKey : item.fieldName;
    const masked = maskFieldValue(item.decoded, parentKey, mask);
    output += masked === item.decoded ? item.token : JSON.stringify(masked);
    cursor = item.index + item.token.length;
  }
  return output + text.slice(cursor);
}

/**
 * Regex source for a JSON property name in raw text. Each letter may also be
 * written as a JSON Unicode escape (`va\u006cue`), with one backslash in plain
 * JSON or two in JSON printed inside a string, so escaped names still match.
 */
function jsonNamePattern(name: string): string {
  return Array.from(name, char => {
    const hex = Array.from(char.charCodeAt(0).toString(16).padStart(4, "0"), digit =>
      /[a-f]/.test(digit) ? `[${digit}${digit.toUpperCase()}]` : digit
    ).join("");
    return `(?:${char}|\\\\{1,2}u${hex})`;
  }).join("");
}
const VALUE_NAME_PATTERN = jsonNamePattern("value");
// A flag literal in raw text. The escaped form covers JSON that is itself a
// string value inside prose (`\"masked\":true`).
const FLAG_LITERAL_PATTERN = new RegExp(
  `\\\\?"(?:${jsonNamePattern("masked")}|${jsonNamePattern("hidden")})\\\\?"\\s*:\\s*true(?![A-Za-z0-9_])`
);
// A `"value"` property with a JSON string value, used only in uncovered text.
// A value cut off before its closing quote runs to the end of the text.
const UNCOVERED_VALUE_PATTERN = new RegExp(
  `("${VALUE_NAME_PATTERN}"\\s*:\\s*)"(?:\\\\.|[^"\\\\])*(?:"|\\\\?$)`,
  "g"
);
// The start of the same property in escaped JSON (`\"value\":\"..."`), e.g. a
// log line that prints a JSON string. The closing quote is found by
// findEndOfEscapedJsonString so an embedded `\\\"` cannot end the value.
const UNCOVERED_ESCAPED_VALUE_START_PATTERN = new RegExp(
  `\\\\"${VALUE_NAME_PATTERN}\\\\"\\s*:\\s*\\\\"`,
  "g"
);
// A JSON Unicode escape such as `\u0073` in `ma\u0073ked`. Used to skip the
// text fast path when a flag name may be escaped this way.
const JSON_UNICODE_ESCAPE_PATTERN = /\\u[0-9a-fA-F]{4}/;
const FLAGGED_TEXT_SCAN_FACTOR = 8;
const FLAGGED_TEXT_SCAN_SLACK = 65536;

interface FlaggedTextScanBudget {
  /** Characters still allowed to be scanned or parsed. */
  remaining: number;
}

/** Index of the `}` closing the `{` at `open`, or -1. Charges the characters it walks. */
function findClosingBrace(text: string, open: number, budget: FlaggedTextScanBudget): number {
  const limit = Math.min(text.length, open + budget.remaining);
  let depth = 0;
  let inString = false;
  let index = open;
  let close = -1;
  for (; index < limit; index++) {
    const char = text[index];
    if (inString) {
      if (char === "\\") index++;
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
    } else if (char === "{" || char === "[") {
      depth++;
    } else if (char === "}" || char === "]") {
      depth--;
      if (depth === 0) {
        if (char === "}") close = index;
        break;
      }
    }
  }
  budget.remaining -= Math.min(index + 1, limit) - open;
  return close;
}

/**
 * Index just past the `"` that closes a JSON string whose content starts at
 * `from`, or the end of the text when it never closes. Charges the
 * characters it walks.
 */
function findEndOfJsonString(text: string, from: number, budget: FlaggedTextScanBudget): number {
  let index = from;
  for (; index < text.length; index++) {
    const char = text[index];
    if (char === "\\") index++;
    else if (char === '"') break;
  }
  budget.remaining -= Math.min(index + 1, text.length) - from;
  return index < text.length ? index + 1 : text.length;
}

function parsesAsJsonObject(span: string): boolean {
  try {
    const parsed: unknown = JSON.parse(span);
    return typeof parsed === "object" && parsed !== null;
  } catch {
    return false;
  }
}

/**
 * Index just past the `\"` that closes an escaped JSON string starting at
 * `from` (the first character after the opening `\"`), or -1 if it never
 * closes. `\\` delivers a backslash to the inner string and may start an
 * inner escape; `\"` ends the string unless the inner string is escaping.
 */
function findEndOfEscapedJsonString(text: string, from: number): number {
  let innerEscaped = false;
  for (let index = from; index < text.length; index++) {
    const char = text[index];
    if (char === "\\" && index + 1 < text.length) {
      const next = text[index + 1];
      if (next === "\\") {
        innerEscaped = !innerEscaped;
        index++;
        continue;
      }
      if (next === '"') {
        if (!innerEscaped) return index + 2;
        innerEscaped = false;
        index++;
        continue;
      }
    }
    innerEscaped = false;
  }
  return -1;
}

function replaceUncoveredEscapedValues(gap: string): string {
  let output = "";
  let cursor = 0;
  UNCOVERED_ESCAPED_VALUE_START_PATTERN.lastIndex = 0;
  for (const match of gap.matchAll(UNCOVERED_ESCAPED_VALUE_START_PATTERN)) {
    const start = match.index;
    if (start === undefined || start < cursor) continue;
    const close = findEndOfEscapedJsonString(gap, start + match[0].length);
    output +=
      gap.slice(cursor, start) + match[0].slice(0, -2) + `\\"${FLAGGED_CI_VARIABLE_REPLACEMENT}\\"`;
    // A value cut off before its closing quote runs to the end of the gap.
    cursor = close === -1 ? gap.length : close;
  }
  return output + gap.slice(cursor);
}

/**
 * Fallback for text outside any valid JSON object. Only applied when that text
 * also holds a flag literal, so `value` fields in unflagged text are untouched.
 * Over-masks any `value` string in a broken gap that carries a flag.
 */
function replaceUncoveredValues(gap: string): string {
  if (!FLAG_LITERAL_PATTERN.test(gap)) return gap;
  return replaceUncoveredEscapedValues(
    gap.replace(
      UNCOVERED_VALUE_PATTERN,
      (_match, prefix: string) => prefix + JSON.stringify(FLAGGED_CI_VARIABLE_REPLACEMENT)
    )
  );
}

/**
 * Structure of the current gap, read left to right once. The scanner uses it
 * to tell whether a complete object sits inside an incomplete flagged parent.
 * Each character is read at most once per gap, so a long incomplete parent
 * does not make later checks rescan its prefix.
 */
interface GapStructure {
  /** First character of the gap. */
  start: number;
  /** Next character to read. */
  scanned: number;
  inString: boolean;
  /** Index of the `"` that opened the current string, or -1. */
  stringStart: number;
  escaped: boolean;
  /** Unclosed `{` and `[` in the gap, outermost first. */
  open: Array<{ char: "{" | "["; index: number }>;
  /** Position in `open` of the outermost `{`, or -1. Kept with the stack so lookups are O(1). */
  firstObject: number;
  /** Last character outside whitespace; a string counts as its closing `"`. */
  last: string | undefined;
}

function newGapStructure(start: number): GapStructure {
  return {
    start,
    scanned: start,
    inString: false,
    stringStart: -1,
    escaped: false,
    open: [],
    firstObject: -1,
    last: undefined,
  };
}

/** Reads `[structure.scanned, end)` into `structure`. Charges the characters it reads. */
function advanceGapStructure(
  structure: GapStructure,
  text: string,
  end: number,
  budget: FlaggedTextScanBudget
): void {
  if (end <= structure.scanned) return;
  budget.remaining -= end - structure.scanned;
  for (let index = structure.scanned; index < end; index++) {
    const char = text[index];
    if (structure.inString) {
      if (structure.escaped) structure.escaped = false;
      else if (char === "\\") structure.escaped = true;
      else if (char === '"') {
        structure.inString = false;
        structure.last = '"';
      }
      continue;
    }
    if (/\s/.test(char)) continue;
    structure.last = char;
    if (char === '"') {
      structure.inString = true;
      structure.stringStart = index;
    } else if (char === "{" || char === "[") {
      if (char === "{" && structure.firstObject === -1)
        structure.firstObject = structure.open.length;
      structure.open.push({ char, index });
    } else if ((char === "}" || char === "]") && structure.open.length > 0) {
      structure.open.pop();
      if (structure.open.length <= structure.firstObject) structure.firstObject = -1;
    }
  }
  structure.scanned = end;
}

/** Start and end of each flag literal in `text`, in order. */
function flagLiteralRanges(text: string): Array<[number, number]> {
  const pattern = new RegExp(FLAG_LITERAL_PATTERN.source, "g");
  return Array.from(text.matchAll(pattern), match => [
    match.index ?? 0,
    (match.index ?? 0) + match[0].length,
  ]);
}

/** True when some range lies inside `[start, end)`. `ranges` is sorted. */
function hasRangeWithin(ranges: Array<[number, number]>, start: number, end: number): boolean {
  let low = 0;
  let high = ranges.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (ranges[middle][0] < start) low = middle + 1;
    else high = middle;
  }
  return low < ranges.length && ranges[low][1] <= end;
}

/**
 * True when the object at `open` is nested inside an incomplete flagged
 * object in the current gap: it is a property value, an array element, or
 * text inside an open string there, and that parent holds a flag before or
 * after `open`. Also true when `open` is text inside a string at gap level
 * (for example an escaped record in a quoted log argument) and the gap holds
 * a flag before that string ends. Such a span must not split the gap, or a
 * value and its flag could land in different gaps. `parentEnd` gives the end
 * of the parent at an index, and `stringEnd` the end of the string opened at
 * an index (the end of the text when either never closes).
 */
function isNestedInIncompleteFlaggedObject(
  structure: GapStructure,
  flagRanges: Array<[number, number]>,
  open: number,
  parentEnd: (index: number) => number,
  stringEnd: (index: number) => number
): boolean {
  if (
    structure.inString &&
    hasRangeWithin(flagRanges, structure.start, stringEnd(structure.stringStart))
  )
    return true;
  if (structure.firstObject === -1) return false;
  const parent = structure.open[structure.firstObject];
  if (!hasRangeWithin(flagRanges, parent.index, parentEnd(parent.index))) return false;
  // A brace inside an open string is string content, not a nested object.
  if (structure.inString) return true;
  const innermost = structure.open[structure.open.length - 1];
  if (innermost.char === "[") return true;
  return structure.last === ":";
}

/**
 * Replaces the value of each GitLab CI/CD variable flagged masked or hidden in
 * text that is not pure JSON: JSON in prose, job logs, error messages, and JSON
 * inside a JSON string. Each `{` is tried as the start of a complete object.
 * A span that parses as an object goes through the JSON scanner in flagged-only
 * mode, so every other byte is kept. Text outside those spans goes through
 * replaceUncoveredValues. Limits:
 * - A truncated object cut before its flag cannot be detected, because the
 *   flag is not in the text yet.
 * - Text after the scan budget runs out is handled as uncovered text.
 * - In a broken span that carries a flag, the fallback masks any `"value"`
 *   string, including values of complete objects nested in that span. Those
 *   nested objects also go through maskJsonText first.
 */
function maskFlaggedCiVariablesInText(
  text: string,
  budget: FlaggedTextScanBudget = {
    remaining: FLAGGED_TEXT_SCAN_FACTOR * text.length + FLAGGED_TEXT_SCAN_SLACK,
  }
): string {
  if (!FLAG_LITERAL_PATTERN.test(text) && !JSON_UNICODE_ESCAPE_PATTERN.test(text)) return text;
  const pieces: string[] = [];
  let gapStart = 0;
  let structure = newGapStructure(0);
  let flagRanges: Array<[number, number]> | undefined;
  // Parents start at increasing indexes, so one cached entry scans each once.
  let cachedParent = -1;
  let cachedParentEnd = text.length;
  const parentEnd = (index: number): number => {
    if (index !== cachedParent) {
      const close = findClosingBrace(text, index, budget);
      cachedParent = index;
      cachedParentEnd = close === -1 ? text.length : close + 1;
    }
    return cachedParentEnd;
  };
  // Strings also start at increasing indexes within and across gaps.
  let cachedString = -1;
  let cachedStringEnd = text.length;
  const stringEnd = (index: number): number => {
    if (index !== cachedString) {
      cachedString = index;
      cachedStringEnd = findEndOfJsonString(text, index + 1, budget);
    }
    return cachedStringEnd;
  };
  const maskSpan = (span: string): string =>
    maskJsonText(span, (value: string) => maskFlaggedCiVariablesInText(value, budget));
  // Complete objects kept inside the current gap, outermost only, in order.
  // They still go through maskJsonText, which decodes escaped property names
  // that the uncovered-text fallback cannot match.
  let retained: Array<[number, number]> = [];
  const maskGap = (end: number): string => {
    let gap = "";
    let cursor = gapStart;
    for (const [spanStart, spanEnd] of retained) {
      if (spanEnd > end) break;
      budget.remaining -= spanEnd - spanStart;
      gap += text.slice(cursor, spanStart) + maskSpan(text.slice(spanStart, spanEnd));
      cursor = spanEnd;
    }
    retained = [];
    return replaceUncoveredValues(gap + text.slice(cursor, end));
  };
  let open = text.indexOf("{");
  while (open !== -1 && budget.remaining > 0) {
    const close = findClosingBrace(text, open, budget);
    if (close !== -1) {
      const spanLength = close - open + 1;
      if (budget.remaining < spanLength) break;
      budget.remaining -= spanLength;
      const span = text.slice(open, close + 1);
      if (parsesAsJsonObject(span)) {
        advanceGapStructure(structure, text, open, budget);
        flagRanges ??= flagLiteralRanges(text);
        if (isNestedInIncompleteFlaggedObject(structure, flagRanges, open, parentEnd, stringEnd)) {
          const previous = retained[retained.length - 1];
          if (previous === undefined || open >= previous[1]) retained.push([open, close + 1]);
          open = text.indexOf("{", open + 1);
          continue;
        }
        pieces.push(maskGap(open));
        // maskJsonText parses the span again.
        budget.remaining -= spanLength;
        pieces.push(maskSpan(span));
        gapStart = close + 1;
        structure = newGapStructure(gapStart);
        open = text.indexOf("{", close + 1);
        continue;
      }
    }
    open = text.indexOf("{", open + 1);
  }
  pieces.push(maskGap(text.length));
  return pieces.join("");
}

function createMaskingEngineFromFile(file: MaskingFile, configPath?: string): MaskingEngine {
  const builtinRules = mergeBuiltinRules(file);
  const rules = [...(file.rules ?? []), ...builtinRules].map(compileRule);
  const maskedErrors = new WeakSet<object>();
  const maskText = (source: string): string => {
    // Flagged variable values are replaced first, so the regex rules below see
    // the replacement text. On the text path that replacement is therefore
    // subject to user keyword rules, while structured and JSON paths emit it
    // verbatim.
    const text = maskFlaggedCiVariablesInText(source);
    const matches: MaskMatch[] = [];
    for (const rule of rules) {
      rule.expression.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = rule.expression.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (end === start) throw new Error(`mask rule ${rule.id} produced an empty match`);
        matches.push({ start, end, replacement: rule.replacement, order: rule.order });
        if (!rule.expression.global) break;
      }
    }
    if (matches.length === 0) return text;
    matches.sort(
      (a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.order - b.order
    );
    const coveredMatches: MaskMatch[] = [];
    for (const match of matches) {
      const previous = coveredMatches[coveredMatches.length - 1];
      if (previous && match.start < previous.end) {
        // Preserve the selected replacement, but cover the entire overlapping
        // interval so a longer secret cannot survive behind a shorter match.
        previous.end = Math.max(previous.end, match.end);
      } else {
        coveredMatches.push({ ...match });
      }
    }
    let output = "";
    let cursor = 0;
    for (const match of coveredMatches) {
      output += text.slice(cursor, match.start) + match.replacement;
      cursor = match.end;
    }
    return output + text.slice(cursor);
  };
  const awsSecretFieldReplacement = builtinRules.find(
    rule => rule.id === "aws-access-key"
  )?.replacement;
  const maskString = (text: string, parentKey?: string): string =>
    applyAwsSecretFieldMask(parentKey, text, maskText(text), awsSecretFieldReplacement);
  return {
    configPath,
    maskText,
    maskValue: <T>(value: T, options?: { masked?: ReadonlySet<string> }): T => {
      const masked = options?.masked;
      if (!masked) return maskStrings(value, maskString) as T;
      return maskStrings(value, (text, parentKey) =>
        masked.has(text)
          ? applyAwsSecretFieldMask(parentKey, text, text, awsSecretFieldReplacement)
          : maskString(text, parentKey)
      ) as T;
    },
    maskToolResult: <T extends Record<string, unknown>>(
      result: T,
      options?: { textFormat?: "plain" | "json" }
    ): T => {
      const output: Record<string, unknown> = { ...result };
      if (Array.isArray(output.content))
        output.content = output.content.map(item => {
          if (!item || typeof item !== "object") return item;
          const block = { ...(item as Record<string, unknown>) };
          if (typeof block.text === "string") {
            block.text =
              options?.textFormat === "plain"
                ? maskString(block.text)
                : maskJsonText(block.text, maskString);
          }
          return block;
        });
      if (output.structuredContent !== undefined)
        output.structuredContent = maskStrings(output.structuredContent, maskString);
      return output as T;
    },
    maskError: (error: unknown): unknown => {
      if (error instanceof Error && !maskedErrors.has(error)) {
        error.message = maskText(error.message);
        maskedErrors.add(error);
      }
      return error;
    },
  };
}

export function createMaskingEngine(options: {
  enabled: boolean;
  configPath?: string;
  workspaceDir?: string;
}): MaskingEngine | undefined {
  if (!options.enabled) return undefined;

  const workspaceDir = path.resolve(options.workspaceDir ?? process.cwd());
  const configPath = options.configPath
    ? path.resolve(workspaceDir, options.configPath)
    : path.join(workspaceDir, ".gitlab-mcp-mask.json");
  if (options.configPath && !fs.existsSync(configPath)) {
    throw new Error(`Configured masking config does not exist: ${configPath}`);
  }
  const file = fs.existsSync(configPath) ? loadFile(configPath) : undefined;
  if (isManagedReference(file))
    throw new Error("Managed masking references require a managed policy resolver");
  return createMaskingEngineFromFile(
    (file as MaskingFile | undefined) ?? {},
    fs.existsSync(configPath) ? configPath : undefined
  );
}

export interface MaskingPolicyResolver {
  readonly managed: boolean;
  /**
   * Select the policy for the projects that can affect a tool response. All
   * project IDs must resolve to one policy group; otherwise a single response
   * could be processed with the wrong policy.
   */
  select(options: {
    gitlabInstance: string;
    projectIds?: readonly unknown[];
    hasProjectScope?: boolean;
    allowBuiltinForUnscoped?: boolean;
  }): MaskingEngine;
}

/**
 * Selects a compiled policy for each tool request. In managed mode this keeps
 * the secret rules on the server while the workspace carries only a group name.
 */
export function createMaskingPolicyResolver(options: {
  enabled: boolean;
  configPath?: string;
  policyFilePath?: string;
  workspaceDir?: string;
}): MaskingPolicyResolver | undefined {
  if (!options.enabled) return undefined;

  const workspaceDir = path.resolve(options.workspaceDir ?? process.cwd());
  const localConfigPath = options.configPath
    ? path.resolve(workspaceDir, options.configPath)
    : path.join(workspaceDir, ".gitlab-mcp-mask.json");
  if (options.configPath && !fs.existsSync(localConfigPath)) {
    throw new Error(`Configured masking config does not exist: ${localConfigPath}`);
  }
  const localConfig = fs.existsSync(localConfigPath) ? loadFile(localConfigPath) : undefined;
  const localGroup = isManagedReference(localConfig) ? localConfig.policyGroup : undefined;

  if (!options.policyFilePath) {
    if (localGroup) throw new Error("Managed masking config requires GITLAB_MASKING_POLICY_FILE");
    const localEngine = createMaskingEngineFromFile(
      (localConfig as MaskingFile | undefined) ?? {},
      localConfigPath
    );
    return { managed: false, select: () => localEngine };
  }

  const policyPath = path.resolve(workspaceDir, options.policyFilePath);
  const policyFile = loadManagedPolicyFile(policyPath);
  if (localGroup && !policyFile.policyGroups[localGroup]) {
    throw new Error(`Managed masking config references unknown policy group: ${localGroup}`);
  }

  const engines = new Map<string, MaskingEngine>();
  for (const [name, policy] of Object.entries(policyFile.policyGroups)) {
    engines.set(name, createMaskingEngineFromFile(policy, policyPath));
  }
  const builtinEngine = createMaskingEngineFromFile({}, policyPath);
  const bindings = new Map<string, string>();
  for (const binding of policyFile.bindings) {
    const instance = normalizeGitLabInstance(binding.gitlabInstance);
    for (const projectId of binding.projectIds) {
      const key = `${instance}#${projectId}`;
      const existing = bindings.get(key);
      if (existing && existing !== binding.policyGroup) {
        throw new Error(`Managed masking policy has conflicting bindings for ${key}`);
      }
      bindings.set(key, binding.policyGroup);
    }
  }

  return {
    managed: true,
    select: ({
      gitlabInstance,
      projectIds = [],
      hasProjectScope = projectIds.length > 0,
      allowBuiltinForUnscoped = false,
    }) => {
      const numericProjectIds = projectIds.map(projectId => {
        if (typeof projectId === "number" && Number.isSafeInteger(projectId) && projectId > 0) {
          return projectId;
        }
        if (typeof projectId === "string" && /^\d+$/.test(projectId)) {
          const numericProjectId = Number(projectId);
          if (Number.isSafeInteger(numericProjectId) && numericProjectId > 0)
            return numericProjectId;
        }
        throw new Error("Managed masking requires numeric project IDs");
      });

      if (numericProjectIds.length === 0) {
        if (hasProjectScope) throw new Error("Managed masking requires a project ID");
        if (allowBuiltinForUnscoped || policyFile.unboundProjectBehavior === "builtin")
          return builtinEngine;
        throw new Error("Managed masking policy does not cover this project-less tool");
      }

      const groups = new Set<string>();
      for (const projectId of numericProjectIds) {
        const group = bindings.get(`${normalizeGitLabInstance(gitlabInstance)}#${projectId}`);
        if (!group) throw new Error("No managed masking policy is bound to this GitLab project");
        groups.add(group);
      }
      if (groups.size !== 1) {
        throw new Error("Managed masking does not allow a tool call to span policy groups");
      }
      const [group] = groups;
      if (localGroup && group !== localGroup) {
        throw new Error("Managed masking policy group does not match the server project binding");
      }
      const engine = engines.get(group);
      if (!engine) throw new Error(`Managed masking policy group is unavailable: ${group}`);
      return engine;
    },
  };
}
