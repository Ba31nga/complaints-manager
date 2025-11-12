// FILE: /app/lib/mappers/complaints.ts
import type {
  Complaint,
  ComplaintMessage,
  AssigneeLetter,
  ReturnInfo,
  ReviewCycle,
} from "@/app/lib/types";

/**
 * database columns (sheet order):
 * A:id B:createdAt C:updatedAt D:subject E:title F:body G:status H:departmentId
 * I:assigneeUserId J:createdById K:reporterType L:reporterFullName M:reporterEmail N:reporterPhone
 * O:reporterJobTitle P:reporterDepartmentId Q:reporterGrade R:reporterClassNumber
 * S:messagesJSON T:assigneeLetterJSON U:returnInfoJSON V:reviewCyclesJSON W:principalReviewJSON X:notificationEmailJSON
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
  "assigneeLetterJSON",
  "returnInfoJSON",
  "reviewCyclesJSON",
  "principalReviewJSON",
  "notificationEmailJSON",
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

  // Pad the row to the expected header length so missing trailing cells
  // (Sheets API may omit empty trailing cells) don't shift indices.
  const expectedCols = COMPLAINTS_HEADER_AR.length;
  const cells = [...row, ...Array(expectedCols).fill("")].slice(
    0,
    expectedCols
  );

  const reporterType = (cells[10] ||
    "PARENT_STUDENT") as Complaint["reporter"]["type"];

  const reporter =
    reporterType === "STAFF"
      ? {
          type: "STAFF" as const,
          fullName: cells[11] || "",
          email: cells[12] || "",
          phone: cells[13] || "",
          jobTitle: cells[14] || "",
          departmentId: cells[15] || "",
        }
      : {
          type: "PARENT_STUDENT" as const,
          fullName: cells[11] || "",
          email: cells[12] || "",
          phone: cells[13] || "",
          grade: cells[16] || "",
          classNumber: cells[17] || "",
        };

  const messages = pj<ComplaintMessage[]>(cells[18], []);
  const parsedAssigneeLetter = pj<AssigneeLetter | undefined>(
    cells[19],
    undefined
  );
  const returnInfo = pj<ReturnInfo | null>(cells[20], null);
  const parsedReviewCycles = pj<ReviewCycle[] | undefined>(
    cells[21],
    undefined
  );
  const principalReview = pj<Complaint["principalReview"]>(cells[22], null);
  const parsedNotificationEmail = pj<Complaint["notificationEmail"]>(
    cells[23],
    undefined
  );

  // Derive assigneeLetter from messages if parsedAssigneeLetter is not present
  const assigneeUserId = cells[8] || "";
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
    // When a nullable JSON field is intentionally cleared (null), write an empty
    // string to the sheet instead of the literal string "null". The sheets
    // updater will then clear the cell contents.
    c.assigneeLetter ? JSON.stringify(c.assigneeLetter) : "",
    c.returnInfo ? JSON.stringify(c.returnInfo) : "",
    c.reviewCycles ? JSON.stringify(c.reviewCycles) : "",
    c.principalReview ? JSON.stringify(c.principalReview) : "",
    c.notificationEmail ? JSON.stringify(c.notificationEmail) : "",
  ];
}
