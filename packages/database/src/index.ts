export { createPrismaClient, databaseReady, getPrismaClient } from "./client.js";
export type { PrismaClient } from "./client.js";
export { createPrismaFinanceProviderFactory } from "./finance-provider.js";
export { DataEncryption, encryptLegacyFinanceData } from "./encryption.js";
export { createPrismaProductProvider } from "./product-provider.js";
export {
  assertMigrationPreflight,
  classifyDatabaseState,
  inspectDatabase,
  LEGACY_BASELINE_MIGRATION,
  migrateDatabase,
  MigrationPreflightError,
} from "./migration.js";
export type {
  DatabaseSnapshot,
  FoundationSchema,
  LegacySchema,
  MigrationState,
} from "./migration.js";
export {
  createRollbackSnapshot,
  createSnapshotCommand,
  verifyRollbackSnapshot,
  verifySnapshotCommand,
} from "./rollback.js";
export type { RollbackSnapshotCommand } from "./rollback.js";
