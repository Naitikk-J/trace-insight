/**
 * Egress policy for the external LLM.
 *
 * The copilot is a third party, so what leaves the platform is decided here and
 * nowhere else. Under the default `REDACTED` policy victim identity never
 * leaves: names, emails, phone numbers and complaint references are replaced by
 * stable pseudonyms, and addresses are truncated so the narrative still reads
 * correctly without shipping a full wallet list off-platform.
 */
import { createHash } from "node:crypto";
import { env } from "../../config/env";

export type DataPolicy = "FULL" | "REDACTED" | "DISABLED";

export function dataPolicy(): DataPolicy {
  return env.LLM_DATA_POLICY;
}

/** Stable per-value pseudonym: the same input always yields the same token. */
function pseudonym(prefix: string, value: string): string {
  const hash = createHash("sha256").update(`${prefix}:${value}`).digest("hex").slice(0, 6);
  return `${prefix}-${hash.toUpperCase()}`;
}

/** `0xabcd…7f31` — enough to correlate within one answer, not to enumerate. */
export function maskAddress(address: string): string {
  if (dataPolicy() === "FULL") return address;
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function maskEntity(name: string | undefined): string | undefined {
  // Exchange and service names are public attribution, never victim identity.
  return name;
}

export function maskVictim(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (dataPolicy() === "FULL") return value;
  return pseudonym("VICTIM", value);
}

export function maskReference(reference: string | undefined): string | undefined {
  if (!reference) return undefined;
  if (dataPolicy() === "FULL") return reference;
  return pseudonym("CASE", reference);
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/g;
const PHONE = /\+?\d[\d\s-]{8,}\d/g;
const LONG_HEX = /\b0x[a-fA-F0-9]{40}\b/g;

/** Last-line defence on free text (investigator questions, notes). */
export function scrubFreeText(text: string): string {
  if (dataPolicy() === "FULL") return text;
  return text
    .replace(EMAIL, "[email redacted]")
    .replace(PHONE, "[phone redacted]")
    .replace(LONG_HEX, (match) => maskAddress(match));
}
