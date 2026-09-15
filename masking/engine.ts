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
  maskValue<T>(value: T): T;
  maskToolResult<T extends Record<string, unknown>>(result: T): T;
  maskError(error: unknown): unknown;
}

const BUILTIN_RULES: MaskRule[] = [
  {
    id: "gitlab-token",
    type: "regex",
    pattern: "\\bgl(?:pat|rt|pt|ft|imt|agent)-[A-Za-z0-9_-]{20,}\\b",
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
    pattern: "(?<![A-Za-z0-9:])(?:[0-9A-Fa-f]{1,4}:){2,7}[0-9A-Fa-f]{0,4}(?![A-Za-z0-9:])",
    flags: "g",
    replacement: "[IP address]",
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

function loadFile(configPath: string): MaskingFile {
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
  const value = parsed as MaskingFile;
  if (value.version !== undefined && value.version !== 1) {
    throw new Error(`Unsupported masking config version: ${String(value.version)}`);
  }
  if (value.rules !== undefined && !Array.isArray(value.rules)) {
    throw new Error(`Masking config ${configPath}.rules must be an array`);
  }
  return value;
}

function maskStrings(value: unknown, mask: (text: string) => string, parentKey?: string): unknown {
  if (typeof value === "string") {
    const masked = mask(value);
    return masked !== value && parentKey === "download_url" ? "[Download URL masked]" : masked;
  }
  if (Array.isArray(value)) return value.map(item => maskStrings(item, mask, parentKey));
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) output[key] = maskStrings(item, mask, key);
    return output;
  }
  return value;
}

function maskJsonText(text: string, mask: (text: string) => string): string {
  try {
    const parsed = JSON.parse(text) as unknown;
    return JSON.stringify(maskStrings(parsed, mask));
  } catch {
    return mask(text);
  }
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
  const file = fs.existsSync(configPath) ? loadFile(configPath) : undefined;
  // User rules get first choice when they overlap a built-in rule. Matching is
  // still performed against the original text so replacements never trigger a
  // later rule (for example Example Corp -> Customer Corp -> Customer organization).
  const rules = [...(file?.rules ?? []), ...mergeBuiltinRules(file)].map(compileRule);
  const maskedErrors = new WeakSet<object>();

  const maskText = (text: string): string => {
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
    let output = "";
    let cursor = 0;
    for (const match of matches) {
      if (match.start < cursor) continue;
      output += text.slice(cursor, match.start) + match.replacement;
      cursor = match.end;
    }
    return output + text.slice(cursor);
  };

  return {
    configPath: fs.existsSync(configPath) ? configPath : undefined,
    maskText,
    maskValue: <T>(value: T): T => maskStrings(value, maskText) as T,
    maskToolResult: <T extends Record<string, unknown>>(result: T): T => {
      const output: Record<string, unknown> = { ...result };
      if (Array.isArray(output.content)) {
        output.content = output.content.map(item => {
          if (!item || typeof item !== "object") return item;
          const block = { ...(item as Record<string, unknown>) };
          if (typeof block.text === "string") block.text = maskJsonText(block.text, maskText);
          return block;
        });
      }
      if (output.structuredContent !== undefined)
        output.structuredContent = maskStrings(output.structuredContent, maskText);
      return output as T;
    },
    maskError: (error: unknown): unknown => {
      if (error instanceof Error) {
        if (maskedErrors.has(error)) return error;
        error.message = maskText(error.message);
        maskedErrors.add(error);
      }
      return error;
    },
  };
}
