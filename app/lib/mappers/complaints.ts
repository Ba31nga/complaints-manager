// FILE: /app/lib/mappers/complaints.ts
import type {
  Complaint,
  ComplaintMessage,
  AssigneeLetter,
  ReturnInfo,
  ReviewCycle,
} from "@/app/lib/types";

/**
 * database!A:T
 * A:id B:createdAt C:updatedAt D:title E:body F:status G:departmentId
 * H:assigneeUserId I:createdById J:reporterType K:reporterFullName L:reporterEmail M:reporterPhone
 * N:reporterJobTitle O:reporterDepartmentId P:reporterGrade Q:reporterClassNumber
 * R:messagesJSON S:returnInfoJSON T:principalReviewJSON
 */
export const COMPLAINTS_HEADER_AR = [
  "id",
  "createdAt",
  "updatedAt",
  "subject",
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
  "principalReviewJSON",
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

  const reporterType = (row[10] ||
    "PARENT_STUDENT") as Complaint["reporter"]["type"];

  const reporter =
    reporterType === "STAFF"
      ? {
          type: "STAFF" as const,
          fullName: row[11] || "",
          email: row[12] || "",
          phone: row[13] || "",
          jobTitle: row[14] || "",
          departmentId: row[15] || "",
        }
      : {
          type: "PARENT_STUDENT" as const,
          fullName: row[11] || "",
          email: row[12] || "",
          phone: row[13] || "",
          grade: row[16] || "",
          classNumber: row[17] || "",
        };

  const messages = pj<ComplaintMessage[]>(row[18], []);
  const parsedAssigneeLetter = pj<AssigneeLetter | undefined>(
    row[19],
    undefined
  );
  const returnInfo = pj<ReturnInfo | null>(row[20], null);
  const parsedReviewCycles = pj<ReviewCycle[] | undefined>(row[21], undefined);
  const principalReview = pj<Complaint["principalReview"]>(row[22], null);
  const parsedNotificationEmail = pj<Complaint["notificationEmail"]>(
    row[23],
    undefined
  );

  // Derive assigneeLetter from messages if parsedAssigneeLetter is not present
  const assigneeUserId = row[8] || "";
  let assigneeLetter = parsedAssigneeLetter;
  if (!assigneeLetter && assigneeUserId) {
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
    subject: row[3] || "",
    title: row[4] || "",
    body: row[5] || "",
    status: row[6] as Complaint["status"],
    departmentId: row[7] || "",
    assigneeUserId: row[8] || null,
    createdById: row[9] || null,
    reporter,
    messages,
    assigneeLetter,
    returnInfo,
    reviewCycles: parsedReviewCycles,
    principalReview,
    notificationEmail: parsedNotificationEmail,
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
    c.subject,
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
    JSON.stringify(c.assigneeLetter ?? null),
    JSON.stringify(c.returnInfo ?? null),
    JSON.stringify(c.reviewCycles ?? null),
    JSON.stringify(c.principalReview ?? null),
    JSON.stringify(c.notificationEmail ?? null),
  ];
}
