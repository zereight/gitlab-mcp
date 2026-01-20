#!/usr/bin/env node

import { startServer } from "./server";
import { logger } from "./logger";
import { tryApplyProfileFromEnv } from "./profiles";

/**
 * Parse CLI arguments for --profile flag
 */
function getProfileFromArgs(): string | undefined {
  const args = process.argv.slice(2);
  let profileName: string | undefined;
  let profileCount = 0;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--profile") {
      const value = args[i + 1];
      // Validate that value exists and is not another flag
      if (!value || value.startsWith("--")) {
        logger.error("--profile requires a profile name (e.g., --profile work)");
        process.exit(1);
      }
      profileCount++;
      if (profileCount === 1) {
        profileName = value;
      }
    }
  }

  if (profileCount > 1) {
    logger.warn({ count: profileCount }, "Multiple --profile flags detected, using first value");
  }

  return profileName;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Apply profile if specified (CLI arg > env var > default)
  const profileName = getProfileFromArgs();
  try {
    const result = await tryApplyProfileFromEnv(profileName);
    if (result) {
      // Handle both profile and preset results
      if ("profileName" in result) {
        logger.info(
          { profile: result.profileName, host: result.host },
          "Using configuration profile"
        );
      } else {
        logger.info({ preset: result.presetName }, "Using configuration preset");
      }
    }
  } catch (error) {
    // Profile errors are fatal - don't start with misconfigured profile
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, "Failed to load profile");
    process.exit(1);
  }

  // Start the server
  await startServer();
}

main().catch((error: unknown) => {
  logger.error(`Failed to start GitLab MCP Server: ${String(error)}`);
  process.exit(1);
});
