export class ValidationError extends Error {
  override readonly name = "ValidationError";
}

export function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${field} must be a non-empty string`);
  }

  return value;
}

export function requireNonNegativeScale(scale: number): number {
  if (!Number.isSafeInteger(scale) || scale < 0) {
    throw new ValidationError("scale must be a non-negative safe integer");
  }

  return scale;
}
