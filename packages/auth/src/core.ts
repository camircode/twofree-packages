import { randomUUID } from "node:crypto";

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import type { PrismaClient } from "@camircode/twofree-database/generated/client";

import { validateBetterAuthSecret } from "./config.js";

export function createCoreAuth(
  prisma: PrismaClient,
  secret: string,
  baseURL: string,
  trustedOrigins: readonly string[],
) {
  const secureCookies = new URL(baseURL).protocol === "https:";
  return betterAuth({
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    secret: validateBetterAuthSecret(secret),
    baseURL,
    basePath: "/api/auth",
    trustedOrigins: [...trustedOrigins],
    emailAndPassword: { enabled: true },
    advanced: {
      useSecureCookies: secureCookies,
      defaultCookieAttributes: {
        httpOnly: true,
        sameSite: "lax",
        secure: secureCookies,
      },
      database: {
        generateId: () => randomUUID(),
      },
    },
  });
}
