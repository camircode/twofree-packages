import { describe, expect, it } from "vitest";

import {
  assertMigrationPreflight,
  classifyDatabaseState,
  type DatabaseSnapshot,
  type MigrationState,
} from "@/migration.js";

function snapshot(overrides: Partial<DatabaseSnapshot> = {}): DatabaseSnapshot {
  return {
    tables: [],
    schemaMigrationVersions: [],
    hasPrismaMigrations: false,
    legacySchema: "absent",
    foundationSchema: "absent",
    ...overrides,
  };
}

describe("Prisma migration preflight", () => {
  it.each([
    ["fresh", snapshot(), "fresh"],
    [
      "existing",
      snapshot({
        tables: ["accounts", "transactions", "transaction_idempotency", "schema_migrations"],
        schemaMigrationVersions: [1, 2],
        legacySchema: "valid",
      }),
      "existing",
    ],
    ["partial", snapshot({ tables: ["accounts"], legacySchema: "partial" }), "partial"],
    [
      "drift",
      snapshot({
        tables: ["accounts", "transactions", "transaction_idempotency", "schema_migrations"],
        schemaMigrationVersions: [1, 2],
        legacySchema: "invalid",
      }),
      "drift",
    ],
  ] as const satisfies readonly [string, DatabaseSnapshot, MigrationState][])(
    "classifies %s databases explicitly",
    (_name, input, expected) => {
      expect(classifyDatabaseState(input)).toBe(expected);
    },
  );

  it("rejects a partially initialized Prisma history instead of applying DDL", () => {
    expect(
      classifyDatabaseState(
        snapshot({ tables: ["_prisma_migrations"], hasPrismaMigrations: true }),
      ),
    ).toBe("partial");
  });

  it("treats an already deployed Prisma foundation as repeatable existing state", () => {
    expect(
      classifyDatabaseState(snapshot({ hasPrismaMigrations: true, foundationSchema: "valid" })),
    ).toBe("existing");
  });

  it("does not misclassify an exact legacy baseline as a partial foundation", () => {
    expect(
      classifyDatabaseState(
        snapshot({
          tables: ["accounts", "transactions", "transaction_idempotency", "schema_migrations"],
          schemaMigrationVersions: [1, 2],
          legacySchema: "valid",
          foundationSchema: "partial",
        }),
      ),
    ).toBe("existing");
  });

  it.each(["partial", "drift"] as const)("aborts %s preflight before Prisma deploy", (state) => {
    expect(() => assertMigrationPreflight(state)).toThrow(
      `Refusing Prisma migration: database is in ${state} state`,
    );
  });
});
