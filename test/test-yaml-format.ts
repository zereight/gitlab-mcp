#!/usr/bin/env node
/**
 * Simple test to verify YAML formatting of responses
 */

import yaml from "js-yaml";

function formatResponse(data: any): string {
  return yaml.dump(data, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false
  });
}

// Test data similar to what GitLab API might return
const testData = {
  id: 12345,
  title: "Test Issue",
  description: "This is a test issue with some description",
  state: "opened",
  created_at: "2024-01-18T10:00:00.000Z",
  author: {
    id: 1,
    username: "testuser",
    name: "Test User"
  },
  labels: ["bug", "priority::high"],
  assignees: [
    { id: 2, username: "assignee1" },
    { id: 3, username: "assignee2" }
  ]
};

console.log("=== Testing YAML Format ===\n");
console.log("Original JSON format:");
const jsonOutput = JSON.stringify(testData, null, 2);
console.log(jsonOutput);
console.log(`\nJSON size: ${jsonOutput.length} characters\n`);

console.log("=== YAML format ===");
const yamlOutput = formatResponse(testData);
console.log(yamlOutput);
console.log(`YAML size: ${yamlOutput.length} characters\n`);

const reduction = ((jsonOutput.length - yamlOutput.length) / jsonOutput.length * 100).toFixed(2);
console.log(`Size reduction: ${reduction}%`);

// Verify data can be parsed back
const parsedYaml = yaml.load(yamlOutput);
console.log("\n✅ YAML can be parsed back successfully");
console.log("Parsed title:", (parsedYaml as any).title);
