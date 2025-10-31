// FILE: /app/lib/mappers/users.ts
import type { User } from "@/app/lib/types";

/** users!A:G = count, fullName, id, armyMail, googleMail, role, department */
export function rowsToUsers(rows: string[][]): User[] {
  return rows
    .filter((r) => (r?.[2] || "").trim()) // require id (col C)
    .map((r) => {
      const name = (r[1] || "").trim(); // B
      const id = (r[2] || "").trim(); // C
      const armyMail = (r[3] || "").trim(); // D
      const googleMail = (r[4] || "").trim(); // E
      const role = (r[5] || "EMPLOYEE").trim() as User["role"]; // F
      const departmentId = (r[6] || "").trim(); // G

      const u: User = { id, name, role, departmentId };
      if (armyMail) u.armyMail = armyMail;
      if (googleMail) u.googleMail = googleMail;
      return u;
    });
}
