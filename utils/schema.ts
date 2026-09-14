import { z } from "zod";

/**
 * Convert a Zod schema to JSON Schema, fixing nullable/optional fields
 * so they are not marked as required, and extracting required fields from the Zod schema.
 */
export const toJSONSchema = (schema: z.ZodTypeAny) => {
  // Zod 4 native conversion. (zod-to-json-schema only understands Zod 3
  // internals and silently emits an empty schema for Zod 4 schemas.)
  // draft-7 keeps output closest to the previous converter; io:"input"
  // describes tool arguments (preprocess/coerce evaluated input-side).
  const jsonSchema = z.toJSONSchema(schema, { target: "draft-7", io: "input" }) as any;

  // Public classes only (no _def access): works on both Zod 3 and Zod 4,
  // whose internals differ (_def.typeName vs _zod.def.type).
  const isOptionalLikeField = (zodType: z.ZodTypeAny): boolean => {
    if (
      zodType instanceof z.ZodOptional ||
      zodType instanceof z.ZodNullable ||
      zodType instanceof z.ZodDefault ||
      zodType instanceof z.ZodCatch
    ) {
      return true;
    }

    // ZodEffects (v3 preprocess/refine/transform): unwrap the inner schema.
    const ZodEffects = (z as any).ZodEffects;
    if (
      ZodEffects &&
      zodType instanceof ZodEffects &&
      typeof (zodType as any).innerType === "function"
    ) {
      return isOptionalLikeField((zodType as any).innerType());
    }

    // ZodBranded: unwrap to the branded schema.
    const ZodBranded = (z as any).ZodBranded;
    if (
      ZodBranded &&
      zodType instanceof ZodBranded &&
      typeof (zodType as any).unwrap === "function"
    ) {
      return isOptionalLikeField((zodType as any).unwrap());
    }

    // Pipes (v3 ZodPipeline / v4 ZodPipe/ZodPreprocess from preprocess/transform):
    // optional-like when either side is optional-like.
    const maybeIn = (zodType as any).in;
    const maybeOut = (zodType as any).out;
    if (maybeIn instanceof z.ZodType && maybeOut instanceof z.ZodType) {
      return isOptionalLikeField(maybeIn) || isOptionalLikeField(maybeOut);
    }

    return false;
  };

  // Extract required fields from Zod schema (authoritative for the root object:
  // the native converter marks defaulted fields as required, we keep the
  // previous convention that defaulted/optional-like fields are not required).
  const { zodRequiredFields, hasAuthoritativeRequired } = (() => {
    if (schema instanceof z.ZodObject) {
      const shape = schema.shape;
      const requiredFields: string[] = [];

      Object.entries(shape).forEach(([key, fieldDef]) => {
        const zodType = fieldDef as z.ZodTypeAny;

        if (!isOptionalLikeField(zodType)) {
          requiredFields.push(key);
        }
      });

      return { zodRequiredFields: requiredFields, hasAuthoritativeRequired: true };
    }
    return { zodRequiredFields: [] as string[], hasAuthoritativeRequired: false };
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
        let requiredSet: Set<string>;
        if (isRoot && hasAuthoritativeRequired) {
          // Zod shape is the source of truth at root level.
          requiredSet = new Set(zodRequiredFields.filter(field => obj.properties[field]));
        } else {
          requiredSet = new Set<string>(obj.required || []);
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

          // Fields with defaults are not required (previous converter semantics).
          if (prop && typeof prop === "object" && "default" in prop) {
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
        // Compute required fields based on combiner semantics:
        // - allOf: union (all schemas apply, so all requirements apply)
        // - anyOf/oneOf: intersection (only shared requirements are universal)
        const requiredSets = variants.map(
          (v: any) => new Set<string>(Array.isArray(v.required) ? v.required : [])
        );
        let mergedRequired: string[];
        if (combiner === "allOf") {
          // Union: any field required in any variant is required
          const all = new Set<string>();
          for (const s of requiredSets) {
            for (const field of s) all.add(field);
          }
          mergedRequired = [...all];
        } else {
          // Intersection: only fields required in ALL variants
          mergedRequired = [...requiredSets[0]].filter(
            field => requiredSets.every((s: Set<string>) => s.has(field))
          );
        }
        if (mergedRequired.length > 0) {
          const existing = new Set<string>(Array.isArray(fixedSchema.required) ? fixedSchema.required : []);
          for (const field of mergedRequired) {
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
