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
      throw new Error(`Managed masking config ${configPath} requires version 2 and a non-empty policyGroup`);
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
  return `${url.protocol}//${url.host}${url.pathname.replace(new RegExp("/api/v4/?$"), "").replace(/[/]+$/, "")}`;
}
  /*
  return `${url.protocol}//${url.host}${url.pathname.replace(/\\/api\\/v4\\/?$/, "").replace(/\\/+$/, "")}`;
}

*/
/*
function normalizeGitLabInstance(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid managed masking GitLab instance: ${value}`);
  }
  return `${url.protocol}//${url.host}${url.pathname.replace(/\\/api\\/v4\\/?$/, "").replace(/\\/+$/, "")}`;
}

function isManagedReference(value: unknown): value is ManagedMaskingReference {
  return Boolean(value && typeof value === "object" && (value as { mode?: unknown }).mode === "managed");
}

*/

function isManagedReference(value: unknown): value is ManagedMaskingReference {
  return Boolean(value && typeof value === "object" && (value as { mode?: unknown }).mode === "managed");
}

function loadManagedPolicyFile(configPath: string): ManagedPolicyFile {
  const parsed = loadJsonFile(configPath);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Managed masking policy file ${configPath} must contain a JSON object`);
  }
  const file = parsed as Partial<ManagedPolicyFile>;
  if (file.version !== 1) throw new Error("Unsupported managed masking policy version");
  if (!file.policyGroups || typeof file.policyGroups !== "object" || Array.isArray(file.policyGroups)) {
    throw new Error("Managed masking policy file policyGroups must be an object");
  }
  if (!Array.isArray(file.bindings)) throw new Error("Managed masking policy file bindings must be an array");
  /*
  if (file.unboundProjectBehavior !== undefined && file.unboundProjectBehavior !== "deny" && file.unboundProjectBehavior !== "builtin") {
    throw new Error("Managed masking policy file unboundProjectBehavior must be \\"deny\\" or \\"builtin\\"");
  }
  */
  if (file.unboundProjectBehavior !== undefined && file.unboundProjectBehavior !== "deny" && file.unboundProjectBehavior !== "builtin") {
    throw new Error('Managed masking policy file unboundProjectBehavior must be "deny" or "builtin"');
  }
  for (const [name, policy] of Object.entries(file.policyGroups)) {
    if (!name.trim()) throw new Error("Managed masking policy group names must not be empty");
    validateMaskingFile(policy, `managed masking policy group ${name}`);
  }
  for (const binding of file.bindings) {
    if (!binding || typeof binding !== "object" || typeof binding.gitlabInstance !== "string" || typeof binding.policyGroup !== "string" || !Array.isArray(binding.projectIds)) {
      throw new Error("Invalid managed masking policy binding");
    }
    normalizeGitLabInstance(binding.gitlabInstance);
    if (!file.policyGroups[binding.policyGroup]) {
      throw new Error(`Managed masking policy binding references unknown group: ${binding.policyGroup}`);
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

function createMaskingEngineFromFile(file: MaskingFile, configPath?: string): MaskingEngine {
  const rules = [...(file.rules ?? []), ...mergeBuiltinRules(file)].map(compileRule);
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
    matches.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start) || a.order - b.order);
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
    configPath,
    maskText,
    maskValue: <T>(value: T): T => maskStrings(value, maskText) as T,
    maskToolResult: <T extends Record<string, unknown>>(result: T): T => {
      const output: Record<string, unknown> = { ...result };
      if (Array.isArray(output.content)) output.content = output.content.map(item => {
        if (!item || typeof item !== "object") return item;
        const block = { ...(item as Record<string, unknown>) };
        if (typeof block.text === "string") block.text = maskJsonText(block.text, maskText);
        return block;
      });
      if (output.structuredContent !== undefined) output.structuredContent = maskStrings(output.structuredContent, maskText);
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
  if (isManagedReference(file)) throw new Error("Managed masking references require a managed policy resolver");
  // User rules get first choice when they overlap a built-in rule. Matching is
  // still performed against the original text so replacements never trigger a
  // later rule (for example Example Corp -> Customer Corp -> Customer organization).
  const localFile = file as MaskingFile | undefined;
  const rules = [...(localFile?.rules ?? []), ...mergeBuiltinRules(localFile)].map(compileRule);
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
    select: ({ gitlabInstance, projectIds = [], hasProjectScope = projectIds.length > 0 }) => {
      const numericProjectIds = projectIds.map(projectId => {
        if (typeof projectId === "number" && Number.isSafeInteger(projectId) && projectId > 0) {
          return projectId;
        }
        if (typeof projectId === "string" && /^\d+$/.test(projectId)) {
          const numericProjectId = Number(projectId);
          if (Number.isSafeInteger(numericProjectId) && numericProjectId > 0) return numericProjectId;
        }
        throw new Error("Managed masking requires numeric project IDs");
      });

      if (numericProjectIds.length === 0) {
        if (hasProjectScope) throw new Error("Managed masking requires a project ID");
        if (policyFile.unboundProjectBehavior === "builtin") return builtinEngine;
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
      return engines.get(group)!;
    },
  };
}
