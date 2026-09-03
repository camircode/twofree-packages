import { spawn } from "node:child_process";

export type RollbackSnapshotCommand = Readonly<{
  command: "pg_dump" | "pg_restore";
  args: readonly string[];
}>;

export function createSnapshotCommand(
  databaseURL: string,
  outputPath: string,
): RollbackSnapshotCommand {
  return {
    command: "pg_dump",
    args: ["--format=custom", "--no-owner", "--file", outputPath, databaseURL],
  };
}

export function verifySnapshotCommand(outputPath: string): RollbackSnapshotCommand {
  return {
    command: "pg_restore",
    args: ["--list", outputPath],
  };
}

function run(command: RollbackSnapshotCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command.command, command.args, { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command.command} failed with exit code ${code ?? "unknown"}`));
    });
  });
}

function required(value: string | undefined, name: string): string {
  if (!value?.trim()) throw new Error(`${name} must be configured`);
  return value.trim();
}

export async function createRollbackSnapshot(
  env: NodeJS.ProcessEnv = process.env,
  outputPath = env.ROLLBACK_SNAPSHOT_PATH,
): Promise<void> {
  await run(
    createSnapshotCommand(
      required(env.DATABASE_URL, "DATABASE_URL"),
      required(outputPath, "ROLLBACK_SNAPSHOT_PATH"),
    ),
  );
}

export async function verifyRollbackSnapshot(
  env: NodeJS.ProcessEnv = process.env,
  outputPath = env.ROLLBACK_SNAPSHOT_PATH,
): Promise<void> {
  await run(verifySnapshotCommand(required(outputPath, "ROLLBACK_SNAPSHOT_PATH")));
}

if (
  import.meta.url === `file://${process.argv[1]}` &&
  /(?:^|[/\\])rollback\.(?:[cm]?js|ts)$/u.test(process.argv[1] ?? "")
) {
  const action = process.argv[2];
  const promise =
    action === "create"
      ? createRollbackSnapshot(process.env, process.argv[3])
      : action === "verify"
        ? verifyRollbackSnapshot(process.env, process.argv[3])
        : Promise.reject(new Error("Usage: db:snapshot [create|verify] [output-path]"));
  promise.catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Rollback snapshot failed");
    process.exitCode = 1;
  });
}
