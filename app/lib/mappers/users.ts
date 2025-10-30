import type { Department, User } from "@/app/lib/types";

/** users!A:G = count, fullName, id, armyMail, googleMail, role, department */
export function rowsToUsers(rows: string[][]): User[] {
  return rows
    .filter((r) => (r?.[2] || "").trim())
    .map((r) => ({
      id: (r[2] || "").trim(),
      name: (r[1] || "").trim(),
      role: (r[5] || "EMPLOYEE").trim() as User["role"],
      departmentId: (r[6] || "").trim(),
    }));
}

/** departments!A:A = simple list of names */
function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/(^-|-$)+/g, "");
}

export function rowsToDepartmentsSimple(rows: string[][]): Department[] {
  const names = rows.map((r) => (r?.[0] || "").trim()).filter(Boolean);
  return names
    .filter((n) => n !== "Departments")
    .map((name) => ({
      id: slugify(name),
      name,
      managerUserId: "",
      members: [],
    }));
}
