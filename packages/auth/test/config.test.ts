import { describe, expect, it } from "vitest";

import { AuthConfigurationError, loadAuthConfig, validateBetterAuthSecret } from "@/config.js";

const validSecret = "slice-one-test-secret-with-more-than-32-bytes";

describe("Better Auth configuration", () => {
  it.each([
    ["absent", undefined],
    ["empty", ""],
    ["too short", "short-secret"],
    ["default", "default-secret-default-secret-default"],
    ["placeholder", "replace-me-with-a-real-secret-value"],
  ])("rejects a %s secret", (_name, secret) => {
    expect(() => validateBetterAuthSecret(secret)).toThrow(AuthConfigurationError);
  });

  it("loads a non-default secret and trusted origins", () => {
    expect(
      loadAuthConfig({
        BETTER_AUTH_SECRET: validSecret,
        BETTER_AUTH_URL: "http://localhost:3000",
        TRUSTED_ORIGINS: "http://localhost:3000,https://app.example.test",
      }),
    ).toEqual({
      secret: validSecret,
      baseURL: "http://localhost:3000",
      trustedOrigins: ["http://localhost:3000", "https://app.example.test"],
    });
  });

  it("accepts the local Tauri origin without weakening HTTP base URL validation", () => {
    expect(
      loadAuthConfig({
        BETTER_AUTH_SECRET: validSecret,
        TRUSTED_ORIGINS: "http://localhost:3000,tauri://localhost",
      }).trustedOrigins,
    ).toEqual(["http://localhost:3000", "tauri://localhost"]);
    expect(() =>
      loadAuthConfig({ BETTER_AUTH_SECRET: validSecret, BETTER_AUTH_URL: "tauri://localhost" }),
    ).toThrow("BETTER_AUTH_URL must use an HTTP or HTTPS origin");
  });
});
