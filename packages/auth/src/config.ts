import { URL } from "node:url";

export const BETTER_AUTH_SECRET_MIN_LENGTH = 32;

export type AuthConfig = Readonly<{
  secret: string;
  baseURL: string;
  trustedOrigins: readonly string[];
}>;

export class AuthConfigurationError extends Error {
  constructor(message: string) {
    super(`Invalid Better Auth configuration: ${message}`);
    this.name = "AuthConfigurationError";
  }
}

const placeholderSecret =
  /(?:change[-_ ]?me|replace[-_ ]?me|your[-_ ]?secret|default[-_ ]?secret|placeholder)/iu;

export function validateBetterAuthSecret(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < BETTER_AUTH_SECRET_MIN_LENGTH) {
    throw new AuthConfigurationError(
      `BETTER_AUTH_SECRET must be at least ${BETTER_AUTH_SECRET_MIN_LENGTH} characters`,
    );
  }
  const secret = value.trim();
  if (placeholderSecret.test(secret) || /^(.)\1{31,}$/u.test(secret)) {
    throw new AuthConfigurationError(
      "BETTER_AUTH_SECRET must not be a placeholder or repeated value",
    );
  }
  return secret;
}

function httpURL(value: unknown, key: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new AuthConfigurationError(`${key} must not be empty`);
  }
  const text = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new AuthConfigurationError(`${key} must be a valid URL`);
  }
  if (!(parsed.protocol === "http:" || parsed.protocol === "https:") || !parsed.host) {
    throw new AuthConfigurationError(`${key} must use an HTTP or HTTPS origin`);
  }
  return text;
}

function trustedOrigin(value: string): string {
  const text = value.trim();
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new AuthConfigurationError("TRUSTED_ORIGINS must contain valid origins");
  }
  if (!parsed.host || !["http:", "https:", "tauri:"].includes(parsed.protocol)) {
    throw new AuthConfigurationError("TRUSTED_ORIGINS must use HTTP, HTTPS, or the Tauri protocol");
  }
  return parsed.protocol === "tauri:" ? `${parsed.protocol}//${parsed.host}` : parsed.origin;
}

export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const baseURL = httpURL(
    env.BETTER_AUTH_URL ?? env.BETTER_AUTH_BASE_URL ?? "http://localhost:3001",
    "BETTER_AUTH_URL",
  );
  const configuredOrigins =
    env.TRUSTED_ORIGINS?.trim() ||
    [
      env.CORS_ORIGIN?.trim() || "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:1420",
      "http://127.0.0.1:1420",
      "tauri://localhost",
    ].join(",");
  const trustedOrigins = [...new Set(configuredOrigins.split(",").map(trustedOrigin))];
  if (trustedOrigins.length === 0) {
    throw new AuthConfigurationError("TRUSTED_ORIGINS must contain at least one origin");
  }
  return Object.freeze({
    secret: validateBetterAuthSecret(env.BETTER_AUTH_SECRET),
    baseURL,
    trustedOrigins: Object.freeze(trustedOrigins),
  });
}
