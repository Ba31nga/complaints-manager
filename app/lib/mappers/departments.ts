// FILE: /app/lib/mappers/departments.ts
import type { Department } from "@/app/lib/types";

function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)+/g, "");
}

function safeJSON<T>(s?: string, fallback: T = [] as unknown as T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

/**
 * Flexible mapper for departments.
 *
 * Supported shapes:
 * - Simple: [name] → A=name (id is synthesized from slug(name))
 * - Extended (new): [name, id, managerUserId?, membersJSON?]
 *
 * Skips header-ish rows like "Departments" or rows with an empty name.
 */
export function rowsToDepartments(rows: string[][]): Department[] {
  const out: Department[] = [];

  for (const r of rows) {
    const a = (r?.[0] || "").trim(); // name
    const b = (r?.[1] || "").trim(); // id
    const c = (r?.[2] || "").trim(); // managerUserId (optional)
    const d = (r?.[3] || "").trim(); // membersJSON (optional)

    // Skip empty / header rows
    if (!a) continue;
    if (/^departments?$/i.test(a) || /^name$/i.test(a)) continue;

    if (r.length >= 2 && b) {
      // Extended/new shape: A=name, B=id, C=managerUserId?, D=membersJSON?
      out.push({
        id: b,
        name: a,
        managerUserId: c || "",
        members: safeJSON<string[]>(d, []),
      });
    } else {
      // Simple/legacy shape: only A=name → synthesize id
      const name = a;
      out.push({
        id: slugify(name) || "dept",
        name,
        managerUserId: "",
        members: [],
      });
    }
  }

  return out;
}
