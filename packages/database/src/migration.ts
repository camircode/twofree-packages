import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

import type { PrismaClient } from "./generated/client/client.js";

import { createPrismaClient } from "./client.js";
import { createRollbackSnapshot, verifyRollbackSnapshot } from "./rollback.js";

export const LEGACY_BASELINE_MIGRATION = "00000000000000_legacy_pg_baseline";

const legacyTables = new Set(["accounts", "transactions", "transaction_idempotency"]);
const expectedLegacyVersions = [1, 2] as const;
const existingTables = new Set([...legacyTables, "schema_migrations"]);
const foundationTables = new Set([
  "auth_user",
  "auth_session",
  "auth_account",
  "auth_verification",
  "accounts",
  "transactions",
  "transaction_idempotency",
  "quarantined_financial_rows",
  "migration_audits",
]);

export type LegacySchema = "absent" | "valid" | "partial" | "invalid";
export type FoundationSchema = "absent" | "valid" | "partial";
export type MigrationState = "fresh" | "existing" | "partial" | "drift";

export type DatabaseSnapshot = Readonly<{
  tables: readonly string[];
  schemaMigrationVersions: readonly number[];
  hasPrismaMigrations: boolean;
  legacySchema: LegacySchema;
  foundationSchema?: FoundationSchema;
}>;

export class MigrationPreflightError extends Error {
  readonly state: Exclude<MigrationState, "fresh" | "existing">;

  constructor(state: "partial" | "drift") {
    super(`Refusing Prisma migration: database is in ${state} state`);
    this.name = "MigrationPreflightError";
    this.state = state;
  }
}

export function assertMigrationPreflight(
  state: MigrationState,
): asserts state is "fresh" | "existing" {
  if (state === "partial" || state === "drift") throw new MigrationPreflightError(state);
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function classifyDatabaseState(snapshot: DatabaseSnapshot): MigrationState {
  const tables = [...new Set(snapshot.tables)].sort();
  const hasLegacyTables = tables.some((table) => legacyTables.has(table));
  const hasAnyState =
    tables.length > 0 ||
    snapshot.schemaMigrationVersions.length > 0 ||
    snapshot.hasPrismaMigrations;

  if (!hasAnyState) return "fresh";
  if (snapshot.hasPrismaMigrations && snapshot.foundationSchema === "valid") return "existing";
  if (snapshot.legacySchema === "invalid") return "drift";

  const hasExactLegacyTables = sameValues(
    [...legacyTables].sort(),
    tables.filter((table) => legacyTables.has(table)),
  );
  const hasExactExistingTables = sameValues([...existingTables].sort(), tables);
  const hasExactHistory = sameValues(
    [...expectedLegacyVersions].map(String),
    [...snapshot.schemaMigrationVersions].sort((left, right) => left - right).map(String),
  );
  if (
    hasExactLegacyTables &&
    hasExactExistingTables &&
    hasExactHistory &&
    snapshot.legacySchema === "valid" &&
    !snapshot.hasPrismaMigrations
  ) {
    return "existing";
  }

  if (snapshot.foundationSchema === "partial") return "partial";
  if (hasLegacyTables || snapshot.legacySchema === "partial" || snapshot.hasPrismaMigrations) {
    return "partial";
  }
  return "partial";
}

type TableRow = { table_name: string };
type MigrationRow = { version: number };
type ColumnRow = { table_name: string; column_name: string };

async function inspectLegacySchema(
  prisma: PrismaClient,
  tables: readonly string[],
): Promise<LegacySchema> {
  const existing = tables.filter((table) => legacyTables.has(table));
  if (existing.length === 0) return "absent";
  if (existing.length !== legacyTables.size) return "partial";

  const columns = await prisma.$queryRawUnsafe<ColumnRow[]>(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN ('accounts', 'transactions', 'transaction_idempotency')
      ORDER BY table_name, ordinal_position`,
  );
  const expected = new Map<string, readonly string[]>([
    [
      "accounts",
      [
        "id",
        "type",
        "label",
        "currency",
        "metadata",
        "created_at",
        "statement_balance_coefficient",
        "statement_balance_scale",
      ],
    ],
    [
      "transactions",
      [
        "id",
        "account_id",
        "amount_coefficient",
        "amount_scale",
        "amount_currency",
        "metadata",
        "created_at",
      ],
    ],
    ["transaction_idempotency", ["idempotency_key", "transaction_id"]],
  ]);
  for (const [table, expectedColumns] of expected) {
    const actual = columns
      .filter((column) => column.table_name === table)
      .map((column) => column.column_name);
    if (!sameValues(actual, expectedColumns)) return "invalid";
  }
  return "valid";
}

function foundationSchema(tables: readonly string[]): FoundationSchema {
  const present = tables.filter((table) => foundationTables.has(table));
  if (present.length === 0) return "absent";
  return present.length === foundationTables.size ? "valid" : "partial";
}

export async function inspectDatabase(prisma: PrismaClient): Promise<DatabaseSnapshot> {
  const tableRows = await prisma.$queryRawUnsafe<TableRow[]>(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name`,
  );
  const tables = tableRows.map(({ table_name }) => table_name);
  const schemaMigrationVersions = tables.includes("schema_migrations")
    ? (
        await prisma.$queryRawUnsafe<MigrationRow[]>(
          "SELECT version FROM schema_migrations ORDER BY version",
        )
      ).map(({ version }) => version)
    : [];
  return {
    tables,
    schemaMigrationVersions,
    hasPrismaMigrations: tables.includes("_prisma_migrations"),
    legacySchema: await inspectLegacySchema(prisma, tables),
    foundationSchema: foundationSchema(tables),
  };
}

function runPrisma(args: readonly string[], env: NodeJS.ProcessEnv): Promise<void> {
  const command = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const cwd = fileURLToPath(new URL("..", import.meta.url));
  return new Promise((resolve, reject) => {
    const child = spawn(command, ["exec", "prisma", ...args], {
      cwd,
      env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Prisma command failed with exit code ${code ?? "unknown"}`));
    });
  });
}

export async function migrateDatabase(
  env: NodeJS.ProcessEnv = process.env,
): Promise<MigrationState> {
  if (!env.DATABASE_URL?.trim())
    throw new Error("DATABASE_URL must be configured before migration");
  if (env.ROLLBACK_SNAPSHOT_PATH?.trim()) {
    await createRollbackSnapshot(env);
    await verifyRollbackSnapshot(env);
  }
  const prisma = createPrismaClient(env.DATABASE_URL);
  try {
    const snapshot = await inspectDatabase(prisma);
    const state = classifyDatabaseState(snapshot);
    assertMigrationPreflight(state);
    if (state === "existing" && snapshot.foundationSchema !== "valid") {
      await runPrisma(["migrate", "resolve", "--applied", LEGACY_BASELINE_MIGRATION], env);
    }
    await runPrisma(["migrate", "deploy"], env);
    return state;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

if (
  import.meta.url === `file://${process.argv[1]}` &&
  /(?:^|[/\\])migration\.(?:[cm]?js|ts)$/u.test(process.argv[1] ?? "")
) {
  migrateDatabase().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Prisma migration failed");
    process.exitCode = 1;
  });
}
