#!/usr/bin/env ts-node

import { z } from "zod";
import { toJSONSchema } from "../utils/schema.js";

interface TestResult {
  name: string;
  status: "passed" | "failed";
  error?: string;
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function runTests(): { passed: number; failed: number } {
  console.log("Testing toJSONSchema utility...");

  const results: TestResult[] = [];

  // Test 1: Required field extraction
  try {
    const schema = z.object({
      requiredField: z.string(),
      optionalField: z.string().optional(),
    });
    const result = toJSONSchema(schema);
    assert(
      result.required?.includes("requiredField"),
      "requiredField should be in required array"
    );
    assert(
      !result.required?.includes("optionalField"),
      "optionalField should NOT be in required array"
    );
    results.push({ name: "required field extraction", status: "passed" });
  } catch (error) {
    results.push({
      name: "required field extraction",
      status: "failed",
      error: (error as Error).message,
    });
  }

  // Test 2: Nullable fields
  try {
    const schema = z.object({
      nullableField: z.string().nullable(),
      requiredField: z.string(),
    });
    const result = toJSONSchema(schema);
    assert(
      result.required?.includes("requiredField"),
      "requiredField should be in required array"
    );
    assert(
      !result.required?.includes("nullableField"),
      "nullableField should NOT be in required array"
    );
    results.push({ name: "nullable fields", status: "passed" });
  } catch (error) {
    results.push({
      name: "nullable fields",
      status: "failed",
      error: (error as Error).message,
    });
  }

  // Test 3: Optional nullable fields
  try {
    const schema = z.object({
      optionalNullable: z.string().optional().nullable(),
      requiredField: z.string(),
    });
    const result = toJSONSchema(schema);
    assert(
      result.required?.includes("requiredField"),
      "requiredField should be in required array"
    );
    assert(
      !result.required?.includes("optionalNullable"),
      "optionalNullable should NOT be in required array"
    );
    results.push({ name: "optional nullable fields", status: "passed" });
  } catch (error) {
    results.push({
      name: "optional nullable fields",
      status: "failed",
      error: (error as Error).message,
    });
  }

  // Test 4: Fields with defaults
  try {
    const schema = z.object({
      fieldWithDefault: z.string().default("default-value"),
      requiredField: z.string(),
    });
    const result = toJSONSchema(schema);
    assert(
      result.required?.includes("requiredField"),
      "requiredField should be in required array"
    );
    assert(
      !result.required?.includes("fieldWithDefault"),
      "fieldWithDefault should NOT be in required array"
    );
    assert(
      result.properties.fieldWithDefault.default === "default-value",
      "default value should be preserved"
    );
    results.push({ name: "fields with defaults", status: "passed" });
  } catch (error) {
    results.push({
      name: "fields with defaults",
      status: "failed",
      error: (error as Error).message,
    });
  }

  // Test 5: Nested objects with shared property names
  try {
    const schema = z.object({
      foo: z.string(), // Required at root
      nested: z.object({
        foo: z.string().optional(), // Optional in nested, shares name with root
      }),
    });
    const result = toJSONSchema(schema);
    assert(
      result.required?.includes("foo"),
      "root foo should be in required array"
    );
    assert(
      result.required?.includes("nested"),
      "nested object should be in required array"
    );
    assert(
      result.properties.nested.required === undefined,
      "nested foo should NOT be in required array"
    );
    results.push({
      name: "nested objects with shared property names",
      status: "passed",
    });
  } catch (error) {
    results.push({
      name: "nested objects with shared property names",
      status: "failed",
      error: (error as Error).message,
    });
  }

  // Test 6: Coerced fields
  try {
    const schema = z.object({
      coercedField: z.coerce.string(),
      optionalCoercedField: z.coerce.string().optional(),
    });
    const result = toJSONSchema(schema);
    assert(
      result.required?.includes("coercedField"),
      "coercedField should be in required array (z.coerce without optional)"
    );
    assert(
      !result.required?.includes("optionalCoercedField"),
      "optionalCoercedField should NOT be in required array (z.coerce with optional)"
    );
    results.push({ name: "coerced fields", status: "passed" });
  } catch (error) {
    results.push({
      name: "coerced fields",
      status: "failed",
      error: (error as Error).message,
    });
  }

  // Print results
  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;

  console.log("\nTest Results:");
  console.log("=".repeat(50));

  results.forEach((result) => {
    if (result.status === "passed") {
      console.log(`  ${result.name}: ${result.status}`);
    } else {
      console.log(`  ${result.name}: ${result.status}`);
      console.log(`    Error: ${result.error}`);
    }
  });

  console.log("=".repeat(50));
  console.log(`Total: ${results.length} tests`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);

  return { passed, failed };
}

// Run tests
runTests();
