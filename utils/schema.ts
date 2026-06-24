import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Convert a Zod schema to JSON Schema, fixing nullable/optional fields
 * so they are not marked as required, and extracting required fields from the Zod schema.
 */
export const toJSONSchema = (schema: z.ZodTypeAny) => {
  const jsonSchema = zodToJsonSchema(schema, { $refStrategy: "none" });

  const isOptionalLikeField = (zodType: z.ZodTypeAny): boolean => {
    const def = zodType._def as any;
    const typeName = def?.typeName;

    if (["ZodOptional", "ZodNullable", "ZodDefault", "ZodCatch"].includes(typeName)) {
      return true;
    }

    if (typeName === "ZodEffects") {
      return isOptionalLikeField(def.schema);
    }

    if (typeName === "ZodBranded") {
      return isOptionalLikeField(def.type);
    }

    if (typeName === "ZodPipeline") {
      return isOptionalLikeField(def.in);
    }

    return false;
  };

  // Extract required fields from Zod schema
  const zodRequiredFields = (() => {
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const requiredFields: string[] = [];

      Object.entries(shape).forEach(([key, fieldDef]) => {
        const zodType = fieldDef as z.ZodTypeAny;

        if (!isOptionalLikeField(zodType)) {
          requiredFields.push(key);
        }
      });

      return requiredFields;
    }
    return [];
  })();

  // Post-process to fix nullable/optional fields and strip verbose keys
  function fixNullableOptional(obj: any, isRoot: boolean = false): any {
    if (obj && typeof obj === "object") {
      // Strip $schema (meta-only, not needed for tool input validation)
      delete obj.$schema;
      // Strip additionalProperties (MCP clients ignore it, saves tokens)
      delete obj.additionalProperties;

      // If this object has properties, process them
      if (obj.properties) {
        const requiredSet = new Set<string>(obj.required || []);

        // Add required fields extracted from Zod schema (only for root object)
        if (isRoot) {
          zodRequiredFields.forEach(field => {
            if (obj.properties[field]) {
              requiredSet.add(field);
            }
          });
        }

        Object.keys(obj.properties).forEach(key => {
          const prop = obj.properties[key];

          // Handle fields that can be null or omitted
          // If a property has type: ["object", "null"] or anyOf with null, it should not be required
          if (prop.anyOf && prop.anyOf.some((t: any) => t.type === "null")) {
            requiredSet.delete(key);
          } else if (Array.isArray(prop.type) && prop.type.includes("null")) {
            requiredSet.delete(key);
          }

          // Recursively process nested objects (not root)
          obj.properties[key] = fixNullableOptional(prop, false);
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
          obj[combiner] = obj[combiner].map((item: any) => fixNullableOptional(item, false));
        }
      });
    }

    return obj;
  }

  const fixedSchema = fixNullableOptional(jsonSchema, true);

  // Flatten top-level anyOf/oneOf into a single object schema for Anthropic API compatibility.
  // The Anthropic API rejects tool input_schema with top-level oneOf/allOf/anyOf.
  for (const combiner of ["anyOf", "oneOf", "allOf"] as const) {
    if (Array.isArray(fixedSchema[combiner])) {
      const variants = fixedSchema[combiner].filter(
        (item: any) => item?.type === "object" && item.properties
      );
      if (variants.length > 0 && variants.length === fixedSchema[combiner].length) {
        fixedSchema.type = "object";
        fixedSchema.properties = fixedSchema.properties || {};
        for (const variant of variants) {
          for (const [key, value] of Object.entries(variant.properties)) {
            if (!fixedSchema.properties[key]) {
              fixedSchema.properties[key] = value;
            }
          }
        }
        // Collect required fields shared across ALL variants (intersection)
        const requiredSets = variants.map(
          (v: any) => new Set<string>(Array.isArray(v.required) ? v.required : [])
        );
        const sharedRequired = [...requiredSets[0]].filter(
          field => requiredSets.every((s: Set<string>) => s.has(field))
        );
        if (sharedRequired.length > 0) {
          const existing = new Set<string>(Array.isArray(fixedSchema.required) ? fixedSchema.required : []);
          for (const field of sharedRequired) {
            existing.add(field);
          }
          fixedSchema.required = [...existing];
        }
        delete fixedSchema[combiner];
      }
    }
  }

  return fixedSchema;
};
