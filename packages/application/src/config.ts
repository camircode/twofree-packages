import { URL } from "node:url";

import { loadAuthConfig, type AuthConfig } from "@camircode/twofree-auth/config.js";

export type RuntimeProfile = "compose-cloud-dev" | "cloud" | "cloud-test" | "local-offline" | "ci";

// Single source of truth for the accepted APP_PROFILE values: the runtime guard
// and the exported union must never drift apart.
export const runtimeProfiles: readonly RuntimeProfile[] = [
  "compose-cloud-dev",
  "cloud",
  "cloud-test",
  "local-offline",
  "ci",
];

export type RuntimeConfig = Readonly<{
  appName: "2free";
  appVersion: string;
  buildSha: string;
  profile: RuntimeProfile;
  apiHost: string;
  apiPort: number;
  webHost: string;
  webPort: number;
  corsOrigin: string;
  databaseUrl: URL;
  auth: AuthConfig;
  financeBoundaryLocked: true;
  destructiveDevelopmentRoutes: boolean;
  dataEncryptionKey: string;
}>;

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(`Invalid configuration: ${message}`);
    this.name = "ConfigurationError";
  }
}

const defaults = {
  APP_VERSION: "0.1.0",
  BUILD_SHA: "local",
  APP_PROFILE: "compose-cloud-dev",
  API_HOST: "127.0.0.1",
  API_PORT: "3001",
  WEB_HOST: "127.0.0.1",
  WEB_PORT: "3000",
  CORS_ORIGIN: "http://localhost:3000",
  DATABASE_URL: "postgresql://2free:2free@127.0.0.1:5432/2free",
  FINANCE_BOUNDARY_LOCKED: "true",
};

function text(env: NodeJS.ProcessEnv, key: keyof typeof defaults): string {
  const value = env[key] ?? defaults[key];
  if (!value?.trim()) throw new ConfigurationError(`${key} must not be empty`);
  return value.trim();
}

function port(value: string, key: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new ConfigurationError(`${key} must be an integer between 1 and 65535`);
  }
  return parsed;
}

function databaseUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ConfigurationError("DATABASE_URL must be a valid PostgreSQL URL");
  }
  if (!(["postgres:", "postgresql:"] as string[]).includes(parsed.protocol) || !parsed.hostname) {
    throw new ConfigurationError("DATABASE_URL must use postgres:// or postgresql://");
  }
  return parsed;
}

function parseDestructiveDevelopmentRoutes(value: string | undefined): boolean {
  return value === "true";
}

function requireFinanceBoundaryLock(value: string | undefined): true {
  if (value !== undefined && value !== "true") {
    throw new ConfigurationError("FINANCE_BOUNDARY_LOCKED must remain true until Slice 5");
  }
  return true;
}

function encryptionKey(env: NodeJS.ProcessEnv, profile: RuntimeProfile): string {
  const value = env.DATA_ENCRYPTION_KEY?.trim();
  if (value) return value;
  if (profile === "ci" || env.NODE_ENV === "test") return Buffer.alloc(32, 7).toString("base64");
  throw new ConfigurationError("DATA_ENCRYPTION_KEY must be configured");
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const profile = text(env, "APP_PROFILE");
  if (!(runtimeProfiles as readonly string[]).includes(profile)) {
    throw new ConfigurationError("APP_PROFILE is not supported");
  }
  const runtimeProfile = profile as RuntimeProfile;
  return Object.freeze({
    appName: "2free",
    appVersion: text(env, "APP_VERSION"),
    buildSha: text(env, "BUILD_SHA"),
    profile: runtimeProfile,
    apiHost: text(env, "API_HOST"),
    apiPort: port(text(env, "API_PORT"), "API_PORT"),
    webHost: text(env, "WEB_HOST"),
    webPort: port(text(env, "WEB_PORT"), "WEB_PORT"),
    corsOrigin: text(env, "CORS_ORIGIN"),
    databaseUrl: databaseUrl(text(env, "DATABASE_URL")),
    auth: loadAuthConfig(env),
    financeBoundaryLocked: requireFinanceBoundaryLock(env.FINANCE_BOUNDARY_LOCKED),
    destructiveDevelopmentRoutes: parseDestructiveDevelopmentRoutes(
      env.ENABLE_DESTRUCTIVE_DEVELOPMENT_ROUTES,
    ),
    dataEncryptionKey: encryptionKey(env, runtimeProfile),
  });
}
