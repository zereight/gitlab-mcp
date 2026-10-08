export interface ListedToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  confirmationHint?: boolean;
  openWorldHint: boolean;
}

export interface ListedToolDecorationContext {
  readonly readOnlyToolNames: ReadonlySet<string>;
  readonly destructiveToolNames: ReadonlySet<string>;
  readonly approveToolNames: ReadonlySet<string>;
  readonly jmespathArgument: string;
  readonly jmespathArgumentDescription: string;
}

const CONFIRMED_ARGUMENT = "_confirmed";
const CONFIRMED_ARGUMENT_DESCRIPTION =
  "Set to true to confirm execution of this approval-required tool.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const clone: Record<string, unknown> = { ...schema };
  if ("$schema" in clone) {
    delete clone.$schema;
  }
  return clone;
}

function withConfirmedArgument(
  schema: Record<string, unknown>,
  toolName: string,
  context: ListedToolDecorationContext
): Record<string, unknown> {
  if (!context.approveToolNames.has(toolName) || !isRecord(schema.properties)) {
    return schema;
  }
  return {
    ...schema,
    properties: {
      ...schema.properties,
      [CONFIRMED_ARGUMENT]: {
        type: "boolean",
        description: CONFIRMED_ARGUMENT_DESCRIPTION,
      },
    },
  };
}

function withJmespathArgument(
  schema: Record<string, unknown>,
  context: ListedToolDecorationContext
): Record<string, unknown> {
  const properties = isRecord(schema.properties) ? { ...schema.properties } : {};
  if (context.jmespathArgument in properties) {
    return schema;
  }
  properties[context.jmespathArgument] = {
    type: "string",
    description: context.jmespathArgumentDescription,
  };
  return { ...schema, properties };
}

function decorateInputSchema(
  schema: unknown,
  toolName: string,
  context: ListedToolDecorationContext
): Record<string, unknown> | undefined {
  if (!isRecord(schema)) {
    return undefined;
  }
  return withJmespathArgument(
    withConfirmedArgument(cloneSchema(schema), toolName, context),
    context
  );
}

export function decorateToolForList<T extends { readonly name: string; inputSchema?: unknown }>(
  tool: T,
  context: ListedToolDecorationContext
): T & { annotations: ListedToolAnnotations } {
  const inputSchema = decorateInputSchema(tool.inputSchema, tool.name, context);

  const annotations: ListedToolAnnotations = { openWorldHint: true };
  if (context.readOnlyToolNames.has(tool.name)) {
    annotations.readOnlyHint = true;
  }
  if (context.destructiveToolNames.has(tool.name)) {
    annotations.destructiveHint = true;
  }
  if (context.approveToolNames.has(tool.name)) {
    annotations.confirmationHint = true;
  }

  if (inputSchema) {
    return { ...tool, inputSchema, annotations };
  }
  return { ...tool, annotations };
}

export function decorateToolsForList<T extends { readonly name: string; inputSchema?: unknown }>(
  tools: readonly T[],
  context: ListedToolDecorationContext
): Array<ReturnType<typeof decorateToolForList<T>>> {
  return tools.map(tool => decorateToolForList(tool, context));
}

export function createListedToolsCache<TInput, TOutput>(
  decorate: (tools: readonly TInput[]) => readonly TOutput[]
): (tools: readonly TInput[], revision: number) => readonly TOutput[] {
  const cache: { tools?: readonly TOutput[]; revision: number } = { revision: -1 };
  return function getListedTools(tools: readonly TInput[], revision: number): readonly TOutput[] {
    if (cache.tools !== undefined && cache.revision === revision) {
      return cache.tools;
    }
    const decorated = decorate(tools);
    cache.tools = decorated;
    cache.revision = revision;
    return decorated;
  };
}
