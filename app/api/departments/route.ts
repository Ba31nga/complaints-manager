// FILE: /app/api/departments/route.ts
import { readDepartmentsRaw } from "@/app/lib/sheets";
import { rowsToDepartments } from "@/app/lib/mappers/departments";
import type { Department } from "@/app/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await readDepartmentsRaw(); // supports A:A or A:D
  const departments: Department[] = rowsToDepartments(rows);
  return Response.json({ data: departments });
}
