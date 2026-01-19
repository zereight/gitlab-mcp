const fs = require("fs");
const path = require("path");

// Check if we're explicitly running unit tests only
const forceUnitOnly = process.env.JEST_UNIT_ONLY === "true";

// Check if .env.test exists to determine if integration tests should run
const envTestPath = path.resolve(__dirname, ".env.test");
const integrationTestsEnabled = !forceUnitOnly && fs.existsSync(envTestPath);

// Check for verbose flag from command line
const isVerbose = process.argv.includes("--verbose");

/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  setupFilesAfterEnv: [
    integrationTestsEnabled
      ? "<rootDir>/tests/setup/setupTests.ts"
      : "<rootDir>/tests/setup/setupTests.unit.ts",
  ],
  transform: {
    "^.+\\.ts$": [
      "ts-jest",
      {
        tsconfig: {
          module: "commonjs",
          moduleResolution: "node",
          allowSyntheticDefaultImports: true,
          esModuleInterop: true,
        },
      },
    ],
  },
  // Remove moduleNameMapper for unit tests to allow proper per-file mock isolation
  moduleNameMapper: integrationTestsEnabled ? {} : {},
  testMatch: integrationTestsEnabled
    ? ["**/tests/**/*.test.ts", "**/?(*.)+(spec|test).ts"]
    : ["**/tests/unit/**/*.test.ts"],
  collectCoverageFrom: ["src/**/*.ts", "!src/**/*.d.ts", "!tests/**/*", "!dist/**/*"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html", "json-summary"],
  // Control output verbosity - by default suppress verbose output, show only warnings/errors
  verbose: isVerbose,
  silent: !isVerbose, // Suppress console.log output in tests unless verbose mode
  testPathIgnorePatterns: integrationTestsEnabled
    ? ["<rootDir>/dist/", "<rootDir>/node_modules/"]
    : ["<rootDir>/dist/", "<rootDir>/node_modules/", "<rootDir>/tests/integration/"],
  modulePathIgnorePatterns: ["<rootDir>/dist/"],
  globalSetup: integrationTestsEnabled ? "<rootDir>/tests/setup/globalSetup.js" : undefined,
  globalTeardown: integrationTestsEnabled ? "<rootDir>/tests/setup/globalTeardown.js" : undefined,
  moduleDirectories: ["node_modules", "src"],
  // Use lifecycle pattern for integration tests with proper sequencing
  ...(integrationTestsEnabled && {
    testSequencer: "<rootDir>/tests/setup/sequencer.js",
    maxWorkers: 1, // Serial execution for lifecycle tests
    testTimeout: 30000, // Longer timeout for API calls
  }),
  ...(!integrationTestsEnabled && {
    testTimeout: 10000, // Standard timeout for unit tests
    maxWorkers: "50%", // Parallel execution with proper per-file mock isolation
    verbose: false,
    silent: true, // Suppress console.log output in unit tests
  }),
};
