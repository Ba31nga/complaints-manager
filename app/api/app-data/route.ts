// FILE: app/api/app-data/route.ts
import type { NextRequest } from "next/server";
import {
  readUsers,
  readDepartmentsRaw,
  readComplaintsRaw,
} from "@/app/lib/sheets";
import { rowsToDepartments } from "@/app/lib/mappers/departments";
import { rowToComplaint } from "@/app/lib/mappers/complaints";
import { rowsToUsers } from "@/app/lib/mappers/users";
import type { Complaint, Department, User } from "@/app/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    // Pull raw data concurrently
    const [sheetUsers, deptRows, complaintRows] = await Promise.all([
      readUsers(), // SheetUser[]
      readDepartmentsRaw(), // string[][]
      readComplaintsRaw(), // string[][]
    ]);

    // Map users (SheetUser -> User)
    const users: User[] = rowsToUsers(
      sheetUsers.map((u) => [
        u.count ?? "",
        u.fullName ?? "",
        u.id ?? "",
        u.armyMail ?? "",
        u.googleMail ?? "",
        (u.role ?? "EMPLOYEE") as string,
        u.department ?? "",
      ])
    );

    // Map departments (supports A or A..D)
    const departments: Department[] = rowsToDepartments(deptRows);

    // Map complaints (skip header if present)
    const start =
      complaintRows.length && (complaintRows[0][0] || "").toLowerCase() === "id"
        ? 1
        : 0;

    const complaints: Complaint[] = complaintRows
      .slice(start)
      .map(rowToComplaint)
      .filter(Boolean) as Complaint[];

    return Response.json({ data: { users, departments, complaints } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Internal error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
