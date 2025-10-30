// FILE: /app/api/complaints/route.ts
import { readComplaintsRaw } from "@/app/lib/sheets";
import { rowToComplaint } from "@/app/lib/mappers/complaints";
import type { Complaint, ComplaintStatus } from "@/app/lib/types";

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
