// FILE: /app/lib/types.ts

/** Roles of internal users (system staff) */
export type Role = "ADMIN" | "MANAGER" | "EMPLOYEE" | "PRINCIPAL";

export type ComplaintStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "AWAITING_PRINCIPAL_REVIEW"
  | "CLOSED";

/** Internal user (system staff)
 *  Matches your sheet columns:
 *  B:name, C:id, D:armyMail, E:googleMail, F:role, G:department
 */
export type User = {
  /** Column C (ת.ז / מזהה פנימי) */
  id: string;

  /** Column B (שם) */
  name: string;

  /** Column F (תפקיד) */
  role: Role;

  /** Column G (מחלקה) → department id/slug you use in the departments tab */
  departmentId: string;

  /** Column D (מייל צבאי) */
  armyMail?: string;

  /** Column E (מייל אזרחי / Google) */
  googleMail?: string;
};

/** Department that receives complaints */
export type Department = {
  id: string;
  name: string;
  managerUserId: string;
  members: string[]; // user ids
};

export type ComplaintMessage = {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
};

export type Reporter =
  | {
      type: "STAFF";
      fullName: string;
      email: string;
      phone: string;
      jobTitle: string;
      departmentId: string;
    }
  | {
      type: "PARENT_STUDENT";
      fullName: string;
      email: string;
      phone: string;
      grade: string;
      classNumber: string;
    };

export type AssigneeLetter = {
  body: string;
  authorUserId: string;
  updatedAt: string;
  submittedAt?: string;
};

export type ReviewCycle = {
  submittedAt: string;
  submittedByUserId: string;
  returnedAt?: string;
  returnReason?: string;
  returnedByUserId?: string;
  approvedAt?: string;
  principalUserId?: string;
  justified?: boolean;
  summary?: string;
};

export type ReturnInfo = {
  count: number;
  reason: string;
  returnedAt: string;
  returnedByUserId: string;
};

export type Complaint = {
  id: string;
  title: string;
  body: string;
  status: ComplaintStatus;
  departmentId: string;
  assigneeUserId?: string | null;
  createdById?: string | null;
  reporter: Reporter;
  createdAt: string;
  updatedAt: string;
  messages: ComplaintMessage[];
  assigneeLetter?: AssigneeLetter;
  returnInfo?: ReturnInfo | null;
  reviewCycles?: ReviewCycle[];
  principalReview?: {
    justified: boolean;
    summary: string;
    principalUserId: string;
    reviewedAt: string;
  };
  notificationEmail?: {
    sent: boolean;
    sentAt?: string;
    to?: string;
  };
};

export type NewComplaintInput = {
  title: string;
  body: string;
  departmentId: string;
  reporter: Reporter;
};
