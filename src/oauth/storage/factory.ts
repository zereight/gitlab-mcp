/**
 * Session Storage Factory
 *
 * Creates and configures the appropriate storage backend based on configuration.
 */

import { SessionStorageBackend, StorageConfig } from "./types";
import { MemoryStorageBackend } from "./memory";
import { FileStorageBackend } from "./file";
import { PostgreSQLStorageBackend } from "./postgresql";
import { logger } from "../../logger";

/**
 * Create a storage backend based on configuration
 *
 * Configuration can come from:
 * 1. Explicit StorageConfig object
 * 2. Environment variables
 *
 * Environment variables:
 * - OAUTH_STORAGE_TYPE: "memory" | "file" | "postgresql" (default: "memory")
 * - OAUTH_STORAGE_FILE_PATH: Path for file storage (default: ./data/oauth-sessions.json)
 * - OAUTH_STORAGE_POSTGRESQL_URL: PostgreSQL connection string
 * - OAUTH_STORAGE_TABLE_PREFIX: PostgreSQL table prefix (default: "oauth_")
 */
export function createStorageBackend(config?: StorageConfig): SessionStorageBackend {
  // Use config if provided, otherwise read from environment
  const storageType = config?.type ?? getEnvStorageType();

  switch (storageType) {
    case "file":
      return createFileBackend(config);
    case "postgresql":
      return createPostgreSQLBackend();
    case "memory":
    default:
      return createMemoryBackend();
  }
}

function getEnvStorageType(): "memory" | "file" | "postgresql" {
  const type = process.env.OAUTH_STORAGE_TYPE?.toLowerCase();
  if (type === "file" || type === "postgresql") {
    return type;
  }
  return "memory";
}

function createMemoryBackend(): MemoryStorageBackend {
  logger.info("Using in-memory session storage (sessions will be lost on restart)");
  return new MemoryStorageBackend();
}

function createFileBackend(config?: StorageConfig): FileStorageBackend {
  const filePath =
    config?.file?.path ?? process.env.OAUTH_STORAGE_FILE_PATH ?? "./data/oauth-sessions.json";

  const saveInterval =
    config?.file?.saveInterval ?? parseInt(process.env.OAUTH_STORAGE_SAVE_INTERVAL ?? "30000", 10);

  const prettyPrint =
    config?.file?.prettyPrint ?? process.env.OAUTH_STORAGE_PRETTY_PRINT === "true";

  logger.info({ filePath, saveInterval }, "Using file-based session storage");

  return new FileStorageBackend({
    filePath,
    saveInterval,
    prettyPrint,
  });
}

function createPostgreSQLBackend(): PostgreSQLStorageBackend {
  // Prisma uses OAUTH_STORAGE_POSTGRESQL_URL or DATABASE_URL from environment
  const connectionString = process.env.OAUTH_STORAGE_POSTGRESQL_URL ?? process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "PostgreSQL storage requires a connection string. " +
        "Set OAUTH_STORAGE_POSTGRESQL_URL or DATABASE_URL environment variable"
    );
  }

  logger.info("Using PostgreSQL session storage (via Prisma)");

  return new PostgreSQLStorageBackend();
}

/**
 * Get storage type from environment or config
 */
export function getStorageType(config?: StorageConfig): "memory" | "file" | "postgresql" {
  return config?.type ?? getEnvStorageType();
}

/**
 * Validate storage configuration
 */
export function validateStorageConfig(config?: StorageConfig): string[] {
  const errors: string[] = [];
  const type = getStorageType(config);

  if (type === "postgresql") {
    // Prisma uses OAUTH_STORAGE_POSTGRESQL_URL or DATABASE_URL
    const connectionString = process.env.OAUTH_STORAGE_POSTGRESQL_URL ?? process.env.DATABASE_URL;

    if (!connectionString) {
      errors.push(
        "PostgreSQL storage requires OAUTH_STORAGE_POSTGRESQL_URL or DATABASE_URL environment variable"
      );
    }
  }

  if (type === "file") {
    const filePath = config?.file?.path ?? process.env.OAUTH_STORAGE_FILE_PATH;
    // File path is optional - defaults to ./data/oauth-sessions.json
    if (filePath) {
      // Basic path validation
      if (filePath.includes("..")) {
        errors.push("File storage path must not contain '..'");
      }
    }
  }

  return errors;
}
