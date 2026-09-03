import { describe, expect, it } from "vitest";

import {
  createInMemoryFinanceProviderFactory,
  type FinanceScope,
} from "@camircode/twofree-data-provider/in-memory-provider.js";
import { ConfigurationError, loadRuntimeConfig, runtimeProfiles } from "@/config.js";
import { createRuntimeApplication } from "@/runtime.js";

const validAuthEnvironment = {
  APP_PROFILE: "ci",
  BETTER_AUTH_SECRET: "slice-one-test-secret-with-more-than-32-bytes",
};
const owner = { ownerId: "runtime-test-owner" } satisfies FinanceScope;

function application() {
  let sequence = 0;
  const target = createRuntimeApplication(
    createInMemoryFinanceProviderFactory({
      ids: { next: () => `demo-${++sequence}` },
      clock: { now: () => new Date("2026-01-01T00:00:00.000Z") },
    }),
  );
  return {
    seed: () => target.seed(owner),
    reset: () => target.reset(owner),
    createAccount: (input: Parameters<typeof target.createAccount>[1]) =>
      target.createAccount(owner, input),
    createTransaction: (input: Parameters<typeof target.createTransaction>[1], key: string) =>
      target.createTransaction(owner, input, key),
    dashboard: () => target.dashboard(owner),
  };
}

describe("runtime application", () => {
  it("keeps the finance boundary locked until the final cutover slice", () => {
    expect(() =>
      loadRuntimeConfig({
        ...validAuthEnvironment,
        FINANCE_BOUNDARY_LOCKED: "false",
      }),
    ).toThrow("FINANCE_BOUNDARY_LOCKED must remain true until Slice 5");
  });

  it.each([
    ["omitted", undefined, false],
    ["false", "false", false],
    ["empty", "", false],
    ["malformed", "yes", false],
    ["uppercase", "TRUE", false],
    ["whitespace", " true ", false],
    ["exact true", "true", true],
  ] as const)("parses destructive route capability %s fail-closed", (_name, value, expected) => {
    const config = loadRuntimeConfig(
      value === undefined
        ? validAuthEnvironment
        : { ...validAuthEnvironment, ENABLE_DESTRUCTIVE_DEVELOPMENT_ROUTES: value },
    );

    expect(config.destructiveDevelopmentRoutes).toBe(expected);
  });

  it("seeds exact typed view models once and resets explicitly", async () => {
    const target = application();

    const first = await target.seed();
    const second = await target.seed();

    expect(first.seeded).toBe(true);
    expect(first.snapshot.transactions[0]?.amount).toEqual({
      currency: "MXN",
      coefficient: "19990",
      scale: 2,
    });
    expect(second.seeded).toBe(false);
    expect((await target.reset()).accounts).toHaveLength(0);
    expect((await target.seed()).snapshot.accounts[0]?.id).toBe("demo-3");
  });

  it("owns account, transaction, and dashboard mapping use cases", async () => {
    const target = application();
    const account = await target.createAccount({
      type: "debit",
      label: "Daily spending",
      currency: "MXN",
      metadata: { source: "test" },
    });
    await target.createTransaction(
      {
        accountId: account.id,
        amount: { currency: "MXN", coefficient: "19990", scale: 3 },
      },
      "application-transaction",
    );

    await expect(target.dashboard()).resolves.toMatchObject({
      accountCount: 1,
      transactionCount: 1,
      totals: [{ currency: "MXN", coefficient: "19990", scale: 3 }],
    });
  });
});

describe("runtime profiles", () => {
  const encryptedEnvironment = {
    ...validAuthEnvironment,
    DATA_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
  };

  it("enumerates every supported deployment profile exactly once", () => {
    expect([...runtimeProfiles]).toEqual([
      "compose-cloud-dev",
      "cloud",
      "cloud-test",
      "local-offline",
      "ci",
    ]);
  });

  it.each(runtimeProfiles)("accepts the %s profile", (profile) => {
    expect(loadRuntimeConfig({ ...encryptedEnvironment, APP_PROFILE: profile }).profile).toBe(
      profile,
    );
  });

  it("accepts cloud as a profile that is neither a development nor a test profile", () => {
    const config = loadRuntimeConfig({ ...encryptedEnvironment, APP_PROFILE: "cloud" });

    expect(config.profile).toBe("cloud");
    expect(config.destructiveDevelopmentRoutes).toBe(false);
  });

  it("requires an explicit encryption key for the cloud profile", () => {
    expect(() => loadRuntimeConfig({ ...validAuthEnvironment, APP_PROFILE: "cloud" })).toThrow(
      ConfigurationError,
    );
  });

  it("rejects an unknown profile", () => {
    expect(() => loadRuntimeConfig({ ...encryptedEnvironment, APP_PROFILE: "staging" })).toThrow(
      "APP_PROFILE is not supported",
    );
  });
});
