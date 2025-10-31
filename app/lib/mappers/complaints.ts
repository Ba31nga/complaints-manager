// FILE: /app/lib/mappers/complaints.ts
import type {
  Complaint,
  ComplaintMessage,
  AssigneeLetter,
  ReturnInfo,
  ReviewCycle,
} from "@/app/lib/types";

/**
 * database!A:S
 * A:id B:createdAt C:updatedAt D:title E:body F:status G:departmentId
 * H:assigneeUserId I:createdById J:reporterType K:reporterFullName L:reporterEmail M:reporterPhone
 * N:reporterJobTitle O:reporterDepartmentId P:reporterGrade Q:reporterClassNumber
 * R:messagesJSON S:returnInfoJSON
 */
export const COMPLAINTS_HEADER_AR = [
  "id",
  "createdAt",
  "updatedAt",
  "title",
  "body",
  "status",
  "departmentId",
  "assigneeUserId",
  "createdById",
  "reporterType",
  "reporterFullName",
  "reporterEmail",
  "reporterPhone",
  "reporterJobTitle",
  "reporterDepartmentId",
  "reporterGrade",
  "reporterClassNumber",
  "messagesJSON",
  "returnInfoJSON",
] as const;

// ✅ Important: DO NOT put an optional param before a required one.
function pj<T>(s: string | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function rowToComplaint(row: string[]): Complaint | null {
  if (!row?.length) return null;

  const reporterType = (row[9] ||
    "PARENT_STUDENT") as Complaint["reporter"]["type"];

  const reporter =
    reporterType === "STAFF"
      ? {
          type: "STAFF" as const,
          fullName: row[10] || "",
          email: row[11] || "",
          phone: row[12] || "",
          jobTitle: row[13] || "",
          departmentId: row[14] || "",
        }
      : {
          type: "PARENT_STUDENT" as const,
          fullName: row[10] || "",
          email: row[11] || "",
          phone: row[12] || "",
          grade: row[15] || "",
          classNumber: row[16] || "",
        };

  const messages = pj<ComplaintMessage[]>(row[17], []);
  const returnInfo = pj<ReturnInfo | null>(row[18], null);

  // Derive assigneeLetter from messages if present: prefer the latest message
  // authored by the assigneeUserId (column H / index 7).
  const assigneeUserId = row[7] || "";
  let assigneeLetter: AssigneeLetter | undefined = undefined;
  if (assigneeUserId) {
    const byAssignee = messages
      .filter((m) => m.authorId === assigneeUserId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    if (byAssignee.length > 0) {
      const latest = byAssignee[0];
      assigneeLetter = {
        body: latest.body || "",
        authorUserId: latest.authorId,
        updatedAt: latest.createdAt,
        submittedAt: latest.createdAt,
      };
    }
  }

  if (!row[0] || !row[1] || !row[3]) return null;

  return {
    id: row[0],
    createdAt: row[1],
    updatedAt: row[2] || row[1],
    title: row[3],
    body: row[4] || "",
    status: row[5] as Complaint["status"],
    departmentId: row[6] || "",
    assigneeUserId: row[7] || null,
    createdById: row[8] || null,
    reporter,
    messages,
    returnInfo,
    // Optional/undeclared columns in sheet remain undefined/null
    // but derive a best-effort assignee letter from messagesJSON so the UI
    // can show and edit the last letter written by the assignee.
    assigneeLetter,
    // returnInfo is stored in column S as JSON (if present)
    // keep reviewCycles undefined for now
    reviewCycles: undefined as unknown as ReviewCycle[] | undefined,
    principalReview: undefined,
    notificationEmail: undefined,
  };
}

export function complaintToRow(c: Complaint): (string | number | boolean)[] {
  // Narrow reporter union
  let reporterJobTitle = "";
  let reporterDepartmentId = "";
  let reporterGrade = "";
  let reporterClassNumber = "";

  if (c.reporter.type === "STAFF") {
    reporterJobTitle = c.reporter.jobTitle;
    reporterDepartmentId = c.reporter.departmentId;
  } else {
    reporterGrade = c.reporter.grade;
    reporterClassNumber = c.reporter.classNumber;
  }

  return [
    c.id,
    c.createdAt,
    c.updatedAt,
    c.title,
    c.body,
    c.status,
    c.departmentId,
    c.assigneeUserId ?? "",
    c.createdById ?? "",
    c.reporter.type,
    c.reporter.fullName,
    c.reporter.email,
    c.reporter.phone,
    reporterJobTitle,
    reporterDepartmentId,
    reporterGrade,
    reporterClassNumber,
    JSON.stringify(c.messages ?? []),
    JSON.stringify(c.returnInfo ?? null),
  ];
}
