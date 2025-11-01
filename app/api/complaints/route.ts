// FILE: /app/api/complaints/route.ts
import { readComplaintsRaw } from "@/app/lib/sheets";
import { rowToComplaint } from "@/app/lib/mappers/complaints";
import type { Complaint, ComplaintStatus } from "@/app/lib/types";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") as ComplaintStatus | null;
  const departmentId = searchParams.get("departmentId");
  const assigneeUserId = searchParams.get("assigneeUserId");
  const q = (searchParams.get("q") || "").toLowerCase();
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const cursor = searchParams.get("cursor"); // ISO (createdAt < cursor)

  const rows = await readComplaintsRaw();
  const start =
    rows.length && (rows[0][0] || "").toLowerCase() === "id" ? 1 : 0;

  let data: Complaint[] = rows
    .slice(start)
    .map(rowToComplaint)
    .filter(Boolean) as Complaint[];

  // Enforce server-side access control based on role
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as
      | { id?: string; department?: string; role?: string }
      | undefined;
    const role = user?.role as string | undefined;
    const userId = user?.id as string | undefined;
    const userDept = user?.department as string | undefined;

    if (!session) {
      // Unauthenticated — no access
      return new Response(JSON.stringify({ error: "Unauthenticated" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (role === "MANAGER") {
      // Managers only see complaints for their department
      if (userDept) data = data.filter((c) => c.departmentId === userDept);
      else data = [];
    } else if (role === "EMPLOYEE") {
      // Employees only see complaints assigned to them
      if (userId) data = data.filter((c) => c.assigneeUserId === userId);
      else data = [];
    }
    // PRINCIPAL/ADMIN: no additional filtering (see everything)
  } catch (err) {
    console.error("Error while checking session for complaints list:", err);
  }

  if (status) data = data.filter((c) => c.status === status);
  if (departmentId) data = data.filter((c) => c.departmentId === departmentId);
  if (assigneeUserId)
    data = data.filter((c) => c.assigneeUserId === assigneeUserId);
  if (q)
    data = data.filter((c) =>
      (c.title + " " + c.body).toLowerCase().includes(q)
    );
  if (cursor)
    data = data.filter(
      (c) => new Date(c.createdAt).getTime() < new Date(cursor).getTime()
    );

  data.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const page = data.slice(0, limit);
  const nextCursor =
    page.length === limit ? page[page.length - 1].createdAt : null;

  return Response.json({ data: { items: page, nextCursor } });
}
