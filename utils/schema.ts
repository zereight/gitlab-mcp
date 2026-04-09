import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

/**
 * Convert a Zod schema to JSON Schema, fixing nullable/optional fields
 * so they are not marked as required.
 */
export const toJSONSchema = (schema: z.ZodTypeAny) => {
  const jsonSchema = zodToJsonSchema(schema, { $refStrategy: "none" });

  // Post-process to fix nullable/optional fields that should truly be optional
  function fixNullableOptional(obj: any): any {
    if (obj && typeof obj === "object") {
      // If this object has properties, process them
      if (obj.properties) {
        const requiredSet = new Set<string>(obj.required || []);
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
