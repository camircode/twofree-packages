import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/client/client.js";

export type { PrismaClient } from "./generated/client/client.js";

type DatabaseUrl = string | URL;

function connectionString(databaseUrl: DatabaseUrl | undefined): string {
  const value = databaseUrl?.toString().trim() || process.env.DATABASE_URL?.trim();
  if (!value) throw new Error("DATABASE_URL must be configured before creating PrismaClient");
  return value;
}

export function createPrismaClient(databaseUrl?: DatabaseUrl): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: connectionString(databaseUrl) }),
  });
}

const globalForPrisma = globalThis as typeof globalThis & {
  __2freePrisma?: PrismaClient;
};

export function getPrismaClient(databaseUrl?: DatabaseUrl): PrismaClient {
  globalForPrisma.__2freePrisma ??= createPrismaClient(databaseUrl);
  return globalForPrisma.__2freePrisma;
}

export async function databaseReady(databaseUrl?: DatabaseUrl): Promise<boolean> {
  const prisma = createPrismaClient(databaseUrl);
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}
