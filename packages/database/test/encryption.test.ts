import { describe, expect, it } from "vitest";

import { DataEncryption } from "../src/encryption.js";

describe("data encryption", () => {
  it("round-trips an authenticated versioned AES-256-GCM envelope", () => {
    const encryption = DataEncryption.fromBase64(Buffer.alloc(32, 3).toString("base64"));
    const envelope = encryption.encrypt({
      description: "private",
      providerReference: "external-1",
    });
    expect(Buffer.from(envelope).includes(Buffer.from("private"))).toBe(false);
    expect(encryption.decrypt(envelope)).toEqual({
      description: "private",
      providerReference: "external-1",
    });
    const tampered = Uint8Array.from(envelope);
    tampered[tampered.length - 1]! ^= 1;
    expect(() => encryption.decrypt(tampered)).toThrow();
  });

  it("rejects invalid key material", () => {
    expect(() => DataEncryption.fromBase64("not-a-key")).toThrow("32-byte key");
  });
});
