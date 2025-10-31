// FILE: /app/api/users/by-email/route.ts
import { NextRequest } from "next/server";
import { getUserByEmail } from "@/app/lib/sheets";
import type { User } from "@/app/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const email = (req.nextUrl.searchParams.get("email") || "")
    .trim()
    .toLowerCase();
  if (!email) {
    return Response.json({ error: "Missing email" }, { status: 400 });
  }

  try {
    const su = await getUserByEmail(email);
    if (!su || !su.id) {
      return Response.json({ data: null }, { status: 200 });
    }

    const user: User = {
      id: (su.id || "").trim(),
      name: (su.fullName || "").trim(),
      role: (su.role || "EMPLOYEE") as User["role"],
      departmentId: (su.department || "").trim(),
      armyMail: su.armyMail?.trim() || undefined,
      googleMail: su.googleMail?.trim() || undefined,
    };

    return Response.json({ data: user });
  } catch (e) {
    console.error("GET /api/users/by-email error:", e);
    return Response.json({ error: "Lookup failed" }, { status: 500 });
  }
}
