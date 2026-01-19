import { z } from "zod";

const DEFAULT_NULL = process.env.DEFAULT_NULL === "true";

export const flexibleBoolean = z.preprocess(val => {
  if (typeof val === "boolean") {
    return val;
  }
  let result = "false";
  try {
    result = String(val).toLowerCase();
  } catch {
    return false;
  }
  return ["true", "t", "1"].includes(result);
}, z.boolean());

export const flexibleBooleanNullable = DEFAULT_NULL
  ? flexibleBoolean.nullable().default(null)
  : flexibleBoolean.nullable();

/**
 * Required ID field that accepts string or number input.
 * Unlike z.coerce.string(), this properly rejects undefined/null values
 * instead of coercing them to the literal string "undefined"/"null".
 */
export const requiredId = z.preprocess(
  val => (val === undefined || val === null ? "" : val),
  z.coerce.string().min(1)
);
