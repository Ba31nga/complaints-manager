// Generic utilities shared across routes

/** remove LRM/RLM marks often introduced by copy/paste */
export function stripRtlMarks(s: string): string {
  return s.replace(/[\u200E\u200F]/g, "");
}

/** normalize a value to an id-like string (trim, strip RTL, remove leading apostrophe) */
export function normalizeId(raw: unknown): string {
  if (raw == null) return "";
  return stripRtlMarks(String(raw)).trim().replace(/^'/, "");
}

/** lowercase+trim string normalization (safe for unknown inputs) */
export function norm(v: unknown): string {
  return stripRtlMarks(String(v ?? ""))
    .trim()
    .toLowerCase();
}

/** case-insensitive role equality */
export function isRole(uRole: unknown, wanted: string): boolean {
  return norm(uRole) === norm(wanted);
}

/** unique elements, preserves first occurrence order */
export function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

/** simple email regex to validate basic address shape */
export const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(input: unknown): boolean {
  const s = String(input ?? "").trim();
  return emailRe.test(s);
}

/**
 * Build robust tokens for department matching.
 * Accepts values like "tiful תפעול הדרכה" or "תפעול/הדרכה" and returns
 * both id-like and name-like normalized tokens.
 */
export function departmentTokens(input: unknown): string[] {
  const raw = String(input ?? "");
  const parts = raw.split(/[\s,|/\\]+/).filter(Boolean);
  const tokens = [raw, ...parts];
  const normalized = tokens.flatMap((t) => [normalizeId(t), norm(t)]);
  return uniq(normalized.filter(Boolean));
}
