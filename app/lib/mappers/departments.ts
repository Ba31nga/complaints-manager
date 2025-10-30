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
 * Flexible mapper:
 * - If rows look like [name] (1 column): create slug id, blank manager, empty members.
 * - If rows look like [id, name, managerUserId, membersJSON] (4 columns): use them.
 * Skips header rows like 'Departments'.
 */
export function rowsToDepartments(rows: string[][]): Department[] {
  const out: Department[] = [];

  for (const r of rows) {
    const a = (r?.[0] || "").trim();
    const b = (r?.[1] || "").trim();
    const c = (r?.[2] || "").trim();
    const d = (r?.[3] || "").trim();

    // skip empty / header lines
    if (!a || a === "Departments") continue;

    if (r.length >= 2 && b) {
      // Extended shape: A:id, B:name, C:managerUserId, D:membersJSON
      out.push({
        id: a,
        name: b,
        managerUserId: c || "",
        members: safeJSON<string[]>(d, []),
      });
    } else {
      // Simple shape: A:name → synthesize
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
