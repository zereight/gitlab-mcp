/**
 * Schema Utilities for Discriminated Union Transformation
 *
 * Provides functions to:
 * 1. Filter actions from discriminated union schemas
 * 2. Flatten discriminated unions to flat schemas (for AI clients)
 * 3. Apply description overrides at all levels
 *
 * Schema Pipeline:
 *   Discriminated Union (source)
 *     → Filter denied actions (remove branches)
 *     → Apply description overrides
 *     → Flatten to single object (for current AI clients)
 *     → Output JSON Schema
 */

import {
  GITLAB_DENIED_ACTIONS,
  GITLAB_SCHEMA_MODE,
  detectSchemaMode,
  getActionDescriptionOverrides,
  getParamDescriptionOverrides,
} from "../config";
import { logger } from "../logger";

// ============================================================================
// Per-Session Schema Mode (for GITLAB_SCHEMA_MODE=auto)
// ============================================================================

// Detected schema mode from clientInfo during initialize (used when GITLAB_SCHEMA_MODE=auto)
// NOTE: This module-level variable works correctly for stdio mode (single client per process).
// For HTTP/SSE modes with multiple concurrent sessions, this is a known limitation -
// all sessions will share the same detected mode. Use explicit GITLAB_SCHEMA_MODE for
// multi-session deployments where different clients may connect simultaneously.
let detectedSchemaMode: "flat" | "discriminated" | null = null;

/**
 * Set the detected schema mode based on clientInfo from MCP initialize
 * Called from server.ts oninitialized callback when GITLAB_SCHEMA_MODE=auto
 *
 * @param clientName - Client name from server.getClientVersion().name
 */
export function setDetectedSchemaMode(clientName?: string): void {
  if (GITLAB_SCHEMA_MODE !== "auto") {
    return; // Only detect when in auto mode
  }

  detectedSchemaMode = detectSchemaMode(clientName);
  logger.info(
    { clientName, detectedMode: detectedSchemaMode },
    "Auto-detected schema mode from client"
  );
}

/**
 * Clear the detected schema mode (for testing or session reset)
 */
export function clearDetectedSchemaMode(): void {
  detectedSchemaMode = null;
}

// ============================================================================
// Types
// ============================================================================

interface JSONSchemaProperty {
  type?: string;
  enum?: string[];
  const?: string;
  description?: string;
  [key: string]: unknown;
}

interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  description?: string;
  oneOf?: JSONSchema[];
  anyOf?: JSONSchema[];
  allOf?: JSONSchema[];
  discriminator?: { propertyName: string };
  $schema?: string;
  [key: string]: unknown;
}

// ============================================================================
// Core Transformation Functions
// ============================================================================

/**
 * Filter branches from a discriminated union JSON schema based on denied actions
 *
 * @param schema - JSON schema with oneOf (discriminated union)
 * @param toolName - Tool name for looking up denied actions
 * @returns Filtered schema with denied action branches removed
 */
export function filterDiscriminatedUnionActions(schema: JSONSchema, toolName: string): JSONSchema {
  const deniedActions = GITLAB_DENIED_ACTIONS.get(toolName.toLowerCase());

  // If no oneOf, this isn't a discriminated union - return as-is
  if (!schema.oneOf || !deniedActions || deniedActions.size === 0) {
    return schema;
  }

  // Deep clone to avoid mutating original
  const result = JSON.parse(JSON.stringify(schema)) as JSONSchema;

  // Filter oneOf branches - keep only allowed actions
  const originalOneOf = result.oneOf ?? [];
  result.oneOf = originalOneOf.filter(branch => {
    // Find the action value in this branch
    const actionProp = branch.properties?.action;
    if (!actionProp) return true; // Keep branches without action

    // Check if action is a const (literal)
    if (actionProp.const) {
      const isAllowed = !deniedActions.has(actionProp.const.toLowerCase());
      if (!isAllowed) {
        logger.debug(`Tool '${toolName}': filtered out action '${actionProp.const}' from schema`);
      }
      return isAllowed;
    }

    // Check if action is an enum with single value
    if (actionProp.enum?.[0]) {
      const isAllowed = !deniedActions.has(actionProp.enum[0].toLowerCase());
      if (!isAllowed) {
        logger.debug(`Tool '${toolName}': filtered out action '${actionProp.enum[0]}' from schema`);
      }
      return isAllowed;
    }

    return true; // Keep if we can't determine action
  });

  // If all branches filtered out, return empty schema
  if (result.oneOf.length === 0) {
    logger.warn(`Tool '${toolName}': all actions filtered out!`);
    return { type: "object", properties: {} };
  }

  // If only one branch left, we could simplify but keep oneOf for consistency
  return result;
}

/**
 * Flatten a discriminated union JSON schema to a flat object schema
 *
 * This is needed because Claude API doesn't support oneOf/anyOf at root level.
 * We merge all branches into a single object with:
 * - action: enum of all allowed actions
 * - All parameters from all branches (made optional except shared required ones)
 *
 * @param schema - JSON schema with oneOf (discriminated union)
 * @returns Flat JSON schema compatible with Claude API
 */
export function flattenDiscriminatedUnion(schema: JSONSchema): JSONSchema {
  // If no oneOf, already flat
  if (!schema.oneOf || schema.oneOf.length === 0) {
    return schema;
  }

  // Collect all properties and track which are shared vs branch-specific
  const allProperties: Record<string, JSONSchemaProperty> = {};
  const propertyBranches: Map<string, number> = new Map(); // prop -> count of branches using it
  const actionValues: string[] = [];
  const totalBranches = schema.oneOf.length;

  // Collect required properties that are required in ALL branches
  const requiredInAllBranches: Set<string> = new Set();
  let firstBranch = true;

  for (const branch of schema.oneOf) {
    if (!branch.properties) continue;

    const branchRequired = new Set(branch.required ?? []);

    for (const [propName, propDef] of Object.entries(branch.properties)) {
      // Track action values
      if (propName === "action") {
        if (propDef.const) {
          actionValues.push(propDef.const);
        } else if (propDef.enum) {
          actionValues.push(...propDef.enum);
        }
        continue; // Handle action separately
      }

      // Merge property definition
      if (!allProperties[propName]) {
        allProperties[propName] = { ...propDef };
        propertyBranches.set(propName, 1);
      } else {
        propertyBranches.set(propName, (propertyBranches.get(propName) ?? 0) + 1);
        // Merge descriptions if different (take longest)
        const existingDesc = allProperties[propName].description ?? "";
        if (propDef.description && propDef.description.length > existingDesc.length) {
          allProperties[propName].description = propDef.description;
        }
      }

      // Track shared required properties
      if (firstBranch) {
        if (branchRequired.has(propName)) {
          requiredInAllBranches.add(propName);
        }
      } else {
        // Remove from shared required if not required in this branch
        if (!branchRequired.has(propName)) {
          requiredInAllBranches.delete(propName);
        }
      }
    }

    firstBranch = false;
  }

  // Build flat schema
  const flatSchema: JSONSchema = {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [...new Set(actionValues)], // Deduplicate
        description: `Action to perform: ${[...new Set(actionValues)].join(", ")}`,
      },
      ...allProperties,
    },
    required: ["action", ...Array.from(requiredInAllBranches)],
  };

  // Add descriptions for parameters that are only used by specific actions
  for (const [propName, count] of propertyBranches) {
    if (count < totalBranches && allProperties[propName]) {
      // This property is not in all branches - find which actions use it
      const actionsUsingProp: string[] = [];
      for (const branch of schema.oneOf) {
        if (branch.properties?.[propName]) {
          const actionProp = branch.properties.action;
          if (actionProp?.const) {
            actionsUsingProp.push(actionProp.const);
          } else if (actionProp?.enum?.[0]) {
            actionsUsingProp.push(actionProp.enum[0]);
          }
        }
      }

      // Append "Used by: action1, action2" to description if not already mentioned
      const propRef = flatSchema.properties?.[propName];
      if (propRef) {
        const currentDesc = propRef.description ?? "";
        if (actionsUsingProp.length > 0 && !currentDesc.includes("Required for")) {
          const actionList = actionsUsingProp.map(a => `'${a}'`).join(", ");
          propRef.description =
            currentDesc + (currentDesc ? " " : "") + `Required for ${actionList} action(s).`;
        }
      }
    }
  }

  // Copy over $schema if present
  if (schema.$schema) {
    flatSchema.$schema = schema.$schema;
  }

  return flatSchema;
}

/**
 * Apply description overrides to properties in a schema branch
 * Helper function for applyDescriptionOverrides
 */
function applyOverridesToProperties(
  properties: Record<string, JSONSchemaProperty>,
  toolName: string,
  paramOverrides: Map<string, string>,
  actionOverrides: Map<string, string>
): void {
  const lowerToolName = toolName.toLowerCase();

  for (const [propName, prop] of Object.entries(properties)) {
    const paramKey = `${lowerToolName}:${propName.toLowerCase()}`;
    const override = paramOverrides.get(paramKey);
    if (override) {
      prop.description = override;
      logger.debug(`Applied param override for '${toolName}.${propName}': "${override}"`);
    }

    // For action property, also check action-level overrides
    if (propName === "action") {
      const actionKey = `${lowerToolName}:action`;
      const actionOverride = actionOverrides.get(actionKey);
      if (actionOverride) {
        prop.description = actionOverride;
        logger.debug(`Applied action override for '${toolName}': "${actionOverride}"`);
      }
    }
  }
}

/**
 * Apply description overrides to a JSON schema
 * Works with both flat schemas and discriminated unions (oneOf)
 *
 * @param schema - JSON schema to modify (flat or discriminated union)
 * @param toolName - Tool name for looking up overrides
 * @returns Schema with description overrides applied
 */
export function applyDescriptionOverrides(schema: JSONSchema, toolName: string): JSONSchema {
  const actionOverrides = getActionDescriptionOverrides();
  const paramOverrides = getParamDescriptionOverrides();

  // Check if any overrides exist for this tool
  const lowerToolName = toolName.toLowerCase();
  const hasOverrides = [...paramOverrides.keys(), ...actionOverrides.keys()].some(key =>
    key.startsWith(`${lowerToolName}:`)
  );

  if (!hasOverrides) {
    return schema;
  }

  // Deep clone
  const result = JSON.parse(JSON.stringify(schema)) as JSONSchema;

  // Handle discriminated union (oneOf) - apply overrides to each branch
  if (result.oneOf) {
    for (const branch of result.oneOf) {
      if (branch.properties) {
        applyOverridesToProperties(branch.properties, toolName, paramOverrides, actionOverrides);
      }
    }
    return result;
  }

  // Handle flat schema
  if (result.properties) {
    applyOverridesToProperties(result.properties, toolName, paramOverrides, actionOverrides);
  }

  return result;
}

// ============================================================================
// Schema Format Configuration
// ============================================================================

/**
 * Get the effective schema mode
 * - If GITLAB_SCHEMA_MODE is 'flat' or 'discriminated': use that directly
 * - If GITLAB_SCHEMA_MODE is 'auto': use detected mode from clientInfo, or 'flat' as fallback
 */
function getSchemaMode(): "flat" | "discriminated" {
  if (GITLAB_SCHEMA_MODE === "auto") {
    // Use detected mode, or fall back to flat if not yet detected
    return detectedSchemaMode ?? "flat";
  }
  // Explicit mode configured
  return GITLAB_SCHEMA_MODE;
}

// ============================================================================
// Main Pipeline Function
// ============================================================================

/**
 * Transform a tool's input schema through the full pipeline:
 * 1. Filter denied actions (removes oneOf branches or enum values)
 * 2. Apply description overrides (works on oneOf branches or flat properties)
 * 3. Conditional flatten (based on GITLAB_SCHEMA_MODE config)
 *
 * @param toolName - Tool name
 * @param inputSchema - Original JSON schema (may be discriminated union or flat)
 * @returns Transformed JSON schema ready for clients
 */
export function transformToolSchema(toolName: string, inputSchema: JSONSchema): JSONSchema {
  let schema = inputSchema;

  // Step 1: Filter denied actions
  if (schema.oneOf) {
    schema = filterDiscriminatedUnionActions(schema, toolName);
  } else if (schema.properties?.action?.enum) {
    // Flat schema with action enum - filter the enum directly
    schema = filterFlatSchemaActions(schema, toolName);
  }

  // Step 2: Apply description overrides (works on oneOf or flat)
  schema = applyDescriptionOverrides(schema, toolName);

  // Step 3: Conditional flatten based on config
  const schemaMode = getSchemaMode();
  if (schemaMode === "flat" && schema.oneOf) {
    schema = flattenDiscriminatedUnion(schema);
  }

  return schema;
}

/**
 * Filter actions from a flat schema (legacy support)
 * Used for schemas that haven't been migrated to discriminated union yet
 */
function filterFlatSchemaActions(schema: JSONSchema, toolName: string): JSONSchema {
  const deniedActions = GITLAB_DENIED_ACTIONS.get(toolName.toLowerCase());

  if (!deniedActions || deniedActions.size === 0) {
    return schema;
  }

  // Deep clone
  const result = JSON.parse(JSON.stringify(schema)) as JSONSchema;

  if (result.properties?.action?.enum) {
    const originalActions = result.properties.action.enum;
    const filteredActions = originalActions.filter(
      action => !deniedActions.has(action.toLowerCase())
    );

    if (filteredActions.length === 0) {
      logger.warn(`Tool '${toolName}': all actions filtered out from flat schema!`);
    } else if (filteredActions.length < originalActions.length) {
      result.properties.action.enum = filteredActions;
      result.properties.action.description = `Action to perform: ${filteredActions.join(", ")}`;
      logger.debug(
        `Tool '${toolName}': filtered flat schema actions [${originalActions.join(", ")}] -> [${filteredActions.join(", ")}]`
      );
    }
  }

  return result;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if all actions are denied for a tool
 */
export function shouldRemoveTool(toolName: string, allActions: string[]): boolean {
  const deniedActions = GITLAB_DENIED_ACTIONS.get(toolName.toLowerCase());
  if (!deniedActions || deniedActions.size === 0) {
    return false;
  }

  const allowedActions = allActions.filter(action => !deniedActions.has(action.toLowerCase()));
  return allowedActions.length === 0;
}

/**
 * Extract action list from a JSON schema
 */
export function extractActionsFromSchema(inputSchema: JSONSchema): string[] {
  // Check flat schema
  if (inputSchema.properties?.action?.enum) {
    return inputSchema.properties.action.enum;
  }

  // Check discriminated union
  if (inputSchema.oneOf) {
    const actions: string[] = [];
    for (const branch of inputSchema.oneOf) {
      const actionProp = branch.properties?.action;
      if (actionProp?.const) {
        actions.push(actionProp.const);
      } else if (actionProp?.enum?.[0]) {
        actions.push(actionProp.enum[0]);
      }
    }
    return actions;
  }

  return [];
}
