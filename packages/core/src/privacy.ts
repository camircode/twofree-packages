import { ValidationError } from "./validation.js";

export type Metadata = Readonly<Record<string, string>>;

const credentialTerm =
  /\b(?:card(?:\s*number)?|cvv|cvc|pin|pan|track(?:\s*data)?|security\s*code)\b/i;
const partialCardKey = /(?:last[\s_-]?(?:four|4)|card[\s_-]?(?:ending|suffix))/i;
const partialCardNumber =
  /\b(?:ending|last\s*(?:four|4)|card\s*(?:number|ending|suffix))\s*(?:is|:|-)?\s*\d{4}(?!\d)/i;
const unseparatedCardNumber = /(?<!\d)\d{13,19}(?!\d)/;
const separatedCardNumber = /(?<!\d)\d{1,4}(?:(?:[\p{P}\p{S}\s]+)\d{1,4}){3,18}(?!\d)/gu;

function containsCardNumber(value: string): boolean {
  if (unseparatedCardNumber.test(value)) return true;

  return [...value.matchAll(separatedCardNumber)].some((match) => {
    const digits = [...match[0]].filter((character) => /\d/u.test(character)).join("");
    return digits.length >= 13 && digits.length <= 19;
  });
}

function containsPartialCardNumber(value: string): boolean {
  return partialCardNumber.test(value);
}

export function assertPrivacySafeText(value: string, field: string): void {
  if (credentialTerm.test(value) || containsCardNumber(value) || containsPartialCardNumber(value)) {
    throw new ValidationError(
      `${field} must not contain payment credentials or card-number fragments`,
    );
  }
}

export function sanitizeMetadata(value: unknown): Metadata {
  if (value === undefined) return Object.freeze({});
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("metadata must be a flat string record");
  }

  const entries = Object.entries(value);
  for (const [key, entry] of entries) {
    if (typeof entry !== "string") throw new ValidationError("metadata values must be strings");
    if (credentialTerm.test(key) || (partialCardKey.test(key) && /^\D*\d{4}\D*$/.test(entry))) {
      throw new ValidationError(
        "metadata must not contain payment credentials or card-number fragments",
      );
    }
    assertPrivacySafeText(key, "metadata");
    assertPrivacySafeText(entry, "metadata");
  }

  return Object.freeze(Object.fromEntries(entries));
}
