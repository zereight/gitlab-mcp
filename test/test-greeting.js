#!/usr/bin/env node

/**
 * Simple test for the greeting functionality
 */

import { GreetingSchema } from "../build/schemas.js";

// Simple test function to validate greeting functionality
function testGreeting() {
  console.log("🧪 Testing Greeting Schema and Functionality...\n");

  // Test 1: Valid Korean greeting
  try {
    const koreanTest = GreetingSchema.parse({
      message: "안녕하세요",
      language: "ko",
    });
    console.log("✅ Korean greeting schema validation passed");
    console.log("   Input:", koreanTest);
  } catch (error) {
    console.error("❌ Korean greeting schema validation failed:", error);
  }

  // Test 2: Valid English greeting
  try {
    const englishTest = GreetingSchema.parse({
      message: "Hello",
      language: "en",
    });
    console.log("✅ English greeting schema validation passed");
    console.log("   Input:", englishTest);
  } catch (error) {
    console.error("❌ English greeting schema validation failed:", error);
  }

  // Test 3: Auto language detection
  try {
    const autoTest = GreetingSchema.parse({
      message: "Hi there!",
      language: "auto",
    });
    console.log("✅ Auto language detection schema validation passed");
    console.log("   Input:", autoTest);
  } catch (error) {
    console.error("❌ Auto language detection schema validation failed:", error);
  }

  // Test 4: Default values
  try {
    const defaultTest = GreetingSchema.parse({});
    console.log("✅ Default values schema validation passed");
    console.log("   Input:", defaultTest);
    console.log("   Language default:", defaultTest.language);
  } catch (error) {
    console.error("❌ Default values schema validation failed:", error);
  }

  // Test 5: Invalid language
  try {
    const invalidTest = GreetingSchema.parse({
      message: "Hello",
      language: "fr", // Invalid language
    });
    console.error("❌ Invalid language should have failed but passed:", invalidTest);
  } catch (error) {
    console.log("✅ Invalid language correctly rejected");
  }

  console.log("\n🎉 Greeting functionality tests completed!");
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testGreeting();
}

export { testGreeting };
