import { requireNonEmptyString, ValidationError } from "./validation.js";

export interface IdGenerator {
  next(): string;
}

export interface Clock {
  now(): Date;
}

export function nextIdentifier(generator: IdGenerator): string {
  const identifier = requireNonEmptyString(generator.next(), "generated identifier");
  if (/\s/.test(identifier))
    throw new ValidationError("generated identifier must not contain whitespace");
  return identifier;
}

export function nowIso(clock: Clock): string {
  const value = clock.now();
  if (!(value instanceof Date) || Number.isNaN(value.valueOf()))
    throw new ValidationError("clock must return a valid date");
  return value.toISOString();
}
