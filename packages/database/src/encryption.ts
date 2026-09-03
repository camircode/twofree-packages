import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type { PrismaClient } from "./client.js";

const VERSION = 1;

export class DataEncryption {
  private constructor(private readonly key: Buffer) {}

  static fromBase64(value: string | undefined, allowTestKey = false): DataEncryption {
    const raw = value?.trim() || (allowTestKey ? Buffer.alloc(32, 7).toString("base64") : "");
    let key: Buffer;
    try {
      key = Buffer.from(raw, "base64");
    } catch {
      throw new Error("DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
    }
    if (
      !raw ||
      key.length !== 32 ||
      key.toString("base64").replace(/=+$/u, "") !== raw.replace(/=+$/u, "")
    ) {
      throw new Error("DATA_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
    }
    return new DataEncryption(key);
  }

  encrypt(value: unknown): Uint8Array<ArrayBuffer> {
    const nonce = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, nonce);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    // Byte 0 is the rotation seam: future key versions can select a different key before decrypting.
    return new Uint8Array(Buffer.concat([Buffer.from([VERSION]), nonce, tag, ciphertext]));
  }

  decrypt<T>(envelope: Uint8Array): T {
    const value = Buffer.from(envelope);
    if (value.length < 30 || value[0] !== VERSION)
      throw new Error("unsupported encrypted data version");
    const decipher = createDecipheriv("aes-256-gcm", this.key, value.subarray(1, 13));
    decipher.setAuthTag(value.subarray(13, 29));
    return JSON.parse(
      Buffer.concat([decipher.update(value.subarray(29)), decipher.final()]).toString("utf8"),
    ) as T;
  }
}

export async function encryptLegacyFinanceData(
  prisma: PrismaClient,
  encryption: DataEncryption,
): Promise<void> {
  const [accounts, transactions] = await Promise.all([
    prisma.financeAccount.findMany({
      where: { OR: [{ labelEncrypted: null }, { metadataEncrypted: null }] },
    }),
    prisma.financeTransaction.findMany({ where: { metadataEncrypted: null } }),
  ]);
  await prisma.$transaction([
    ...accounts.map((account) =>
      prisma.financeAccount.update({
        where: { id_ownerId: { id: account.id, ownerId: account.ownerId } },
        data: {
          label: "[encrypted]",
          labelEncrypted: account.labelEncrypted ?? encryption.encrypt(account.label),
          metadata: {},
          metadataEncrypted: account.metadataEncrypted ?? encryption.encrypt(account.metadata),
        },
      }),
    ),
    ...transactions.map((transaction) =>
      prisma.financeTransaction.update({
        where: { id_ownerId: { id: transaction.id, ownerId: transaction.ownerId } },
        data: { metadata: {}, metadataEncrypted: encryption.encrypt(transaction.metadata) },
      }),
    ),
  ]);
}
