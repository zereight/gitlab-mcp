/**
 * Prisma Configuration for gitlab-mcp OAuth Storage
 *
 * Uses OAUTH_STORAGE_POSTGRESQL_URL environment variable.
 * If not set, Prisma client will not be initialized.
 */
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use our consistent env variable naming
    url: process.env["OAUTH_STORAGE_POSTGRESQL_URL"] ?? process.env["DATABASE_URL"],
  },
});
