import { describe, expect, it } from "vitest";

import { createSnapshotCommand, verifySnapshotCommand } from "@/rollback.js";

describe("rollback-only PostgreSQL snapshots", () => {
  it("creates a custom-format snapshot without issuing application writes", () => {
    expect(createSnapshotCommand("postgresql://db/2free", ".backups/slice-1.dump")).toEqual({
      command: "pg_dump",
      args: [
        "--format=custom",
        "--no-owner",
        "--file",
        ".backups/slice-1.dump",
        "postgresql://db/2free",
      ],
    });
  });

  it("verifies the snapshot archive before rollback is considered available", () => {
    expect(verifySnapshotCommand(".backups/slice-1.dump")).toEqual({
      command: "pg_restore",
      args: ["--list", ".backups/slice-1.dump"],
    });
  });
});
