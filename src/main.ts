#!/usr/bin/env node

import { startServer } from "./server";
import { logger } from "./logger";
import { tryApplyProfileFromEnv, findProjectConfig, getProjectConfigSummary } from "./profiles";
import { parseCliArgs, displayProjectConfig } from "./cli-utils";

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const cliArgs = parseCliArgs();

  // Handle --show-project-config flag (display and exit)
  if (cliArgs.showProjectConfig) {
    try {
      const projectConfig = await findProjectConfig(process.cwd());
      displayProjectConfig(projectConfig);
      process.exit(0);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error({ error: message }, "Failed to load project config");
      process.exit(1);
    }
  }

  // Apply profile if specified (CLI arg > env var > default)
  try {
    const result = await tryApplyProfileFromEnv(cliArgs.profileName);
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

  // Load project config unless --no-project-config is specified
  if (!cliArgs.noProjectConfig) {
    try {
      const projectConfig = await findProjectConfig(process.cwd());
      if (projectConfig) {
        const summary = getProjectConfigSummary(projectConfig);
        logger.info(
          {
            path: projectConfig.configPath,
            preset: summary.presetSummary,
            profile: summary.profileSummary,
          },
          "Loaded project configuration"
        );

        // Note: Project config is loaded and logged but not yet enforced.
        // Scope restrictions require integration with tool execution layer.
        // See: https://github.com/structured-world/gitlab-mcp/issues/61
      }
    } catch (error) {
      // Project config errors are warnings, not fatal
      const message = error instanceof Error ? error.message : String(error);
      logger.warn({ error: message }, "Failed to load project config, continuing without it");
    }
  }

  // Start the server
  await startServer();
}

main().catch((error: unknown) => {
  logger.error(`Failed to start GitLab MCP Server: ${String(error)}`);
  process.exit(1);
});
