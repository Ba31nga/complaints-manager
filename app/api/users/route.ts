// FILE: /app/api/users/route.ts
import { readUsers } from "@/app/lib/sheets";
import { rowsToUsers } from "@/app/lib/mappers/users";
import type { User } from "@/app/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const sheetUsers = await readUsers(); // SheetUser[]
  const users: User[] = rowsToUsers(
    sheetUsers.map((u) => [
      u.count ?? "",
      u.fullName ?? "",
      u.id ?? "",
      u.armyMail ?? "",
      u.googleMail ?? "",
      u.role ?? "",
      u.department ?? "",
    ])
  );
  return Response.json({ data: users });
}
