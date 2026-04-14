import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Convert a Zod schema to JSON Schema, fixing nullable/optional fields
 * so they are not marked as required, and extracting required fields from the Zod schema.
 */
export const toJSONSchema = (schema: z.ZodTypeAny) => {
  const jsonSchema = zodToJsonSchema(schema, { $refStrategy: "none" });

  // Extract required fields from Zod schema
  function extractRequiredFields(zodSchema: z.ZodTypeAny): string[] {
    if (zodSchema instanceof z.ZodObject) {
      const shape = zodSchema.shape;
      const requiredFields: string[] = [];

      Object.entries(shape).forEach(([key, fieldDef]) => {
        // Check if the field is not optional and not nullable
        // Zod marks optional fields with _def.typeName === 'ZodOptional'
        const def = fieldDef as any;
        const isOptional = def._def?.typeName === 'ZodOptional' || def._def?.optional === true;
        const isNullable = def._def?.typeName === 'ZodNullable' || def._def?.nullable === true;

        if (!isOptional && !isNullable) {
          requiredFields.push(key);
        }
      });

      return requiredFields;
    }
    return [];
  }

  // Post-process to fix nullable/optional fields and strip verbose keys
  function fixNullableOptional(obj: any): any {
    if (obj && typeof obj === "object") {
      // Strip $schema (meta-only, not needed for tool input validation)
      delete obj.$schema;
      // Strip additionalProperties (MCP clients ignore it, saves tokens)
      delete obj.additionalProperties;

      // If this object has properties, process them
      if (obj.properties) {
        const requiredSet = new Set<string>(obj.required || []);

        // Add required fields extracted from Zod schema
        const zodRequiredFields = extractRequiredFields(schema);
        zodRequiredFields.forEach(field => {
          if (obj.properties[field]) {
            requiredSet.add(field);
          }
        });

        Object.keys(obj.properties).forEach(key => {
          const prop = obj.properties[key];

          // Handle fields that can be null or omitted
          // If a property has type: ["object", "null"] or anyOf with null, it should not be required
          if (prop.anyOf && prop.anyOf.some((t: any) => t.type === "null")) {
            requiredSet.delete(key);
          } else if (Array.isArray(prop.type) && prop.type.includes("null")) {
            requiredSet.delete(key);
          }

          // Recursively process nested objects
          obj.properties[key] = fixNullableOptional(prop);
        });

        // Normalize the required array after processing all properties
        if (requiredSet.size > 0) {
          obj.required = Array.from(requiredSet);
        } else if (Object.prototype.hasOwnProperty.call(obj, "required")) {
          delete obj.required;
        }
      }

      // Process anyOf/allOf/oneOf
      ["anyOf", "allOf", "oneOf"].forEach(combiner => {
        if (obj[combiner]) {
          obj[combiner] = obj[combiner].map(fixNullableOptional);
        }
      });
    }

    return obj;
  }

  return fixNullableOptional(jsonSchema);
};