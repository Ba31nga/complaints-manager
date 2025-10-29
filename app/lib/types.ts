/** Roles of internal users (system staff) */
export type Role = "ADMIN" | "MANAGER" | "EMPLOYEE" | "PRINCIPAL";

/**
 * Complaint lifecycle
 * - OPEN: created, unassigned
 * - ASSIGNED: assigned to an employee/manager
 * - IN_PROGRESS: assignee is composing the formal reply letter
 * - AWAITING_PRINCIPAL_REVIEW: assignee submitted; waiting for principal review
 * - CLOSED: principal approved & final email sent
 */
export type ComplaintStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "AWAITING_PRINCIPAL_REVIEW"
  | "CLOSED";

/** Internal user (system staff) */
export type User = {
  id: string;
  name: string;
  role: Role;
  departmentId: string;
};

/** Department that receives complaints */
export type Department = {
  id: string;
  name: string;
  managerUserId: string;
  members: string[]; // user ids
};

/** Message/comment in a complaint thread (optional/internal notes if you keep them) */
export type ComplaintMessage = {
  id: string;
  authorId: string; // user id
  body: string;
  createdAt: string; // ISO string
};

/** Who submitted the complaint (external person) */
export type Reporter =
  | {
      type: "STAFF";
      fullName: string;
      email: string;
      phone: string;
      jobTitle: string;
      /** The reporter's own department (not necessarily the target department) */
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

/** The formal reply that the assignee prepares and submits */
export type AssigneeLetter = {
  body: string;
  /** who last edited/submitted the letter */
  authorUserId: string;
  /** when it was last saved */
  updatedAt: string; // ISO
  /** when it was submitted to principal (set on submit) */
  submittedAt?: string; // ISO
};

/** A single review round (optional audit log) */
export type ReviewCycle = {
  /** when the assignee submitted to principal */
  submittedAt: string; // ISO
  submittedByUserId: string;
  /** principal actions */
  returnedAt?: string; // ISO
  returnReason?: string;
  returnedByUserId?: string;
  /** or approval */
  approvedAt?: string; // ISO
  principalUserId?: string;
  justified?: boolean;
  summary?: string;
};

/**
 * When the principal sends a complaint back for rewrite,
 * we keep the latest reason + count for UX and analytics.
 */
export type ReturnInfo = {
  count: number; // number of times returned for rewrite
  reason: string;
  returnedAt: string; // ISO
  returnedByUserId: string;
};

/**
 * Core complaint entity
 * - `departmentId` → subject department that must handle it
 * - `reporter` → who submitted it
 */
export type Complaint = {
  id: string;

  /** Basic details */
  title: string; // title of complaint
  body: string; // details/description
  status: ComplaintStatus;

  /** Target department responsible for handling */
  departmentId: string;

  /** Staff user currently assigned to work on it */
  assigneeUserId?: string | null;

  /** If reporter is also a system user (optional) */
  createdById?: string | null;

  /** External reporter details */
  reporter: Reporter;

  /** Timestamps */
  createdAt: string; // ISO (date of creation)
  updatedAt: string; // ISO

  /** Discussion / responses thread (optional/internal) */
  messages: ComplaintMessage[];

  /** The formal assignee letter (draft + submit timestamp) */
  assigneeLetter?: AssigneeLetter;

  /**
   * If the principal returned the complaint for rewrite,
   * the latest return state is kept here (and count increments).
   */
  returnInfo?: ReturnInfo | null;

  /**
   * Optional review history (each submit/return/approve forms a cycle)
   */
  reviewCycles?: ReviewCycle[];

  /**
   * Principal review — filled right before closure
   */
  principalReview?: {
    justified: boolean;
    summary: string;
    principalUserId: string;
    reviewedAt: string;
  };

  /**
   * Final email details — filled after principal clicks “Send”
   */
  notificationEmail?: {
    sent: boolean;
    sentAt?: string;
    to?: string; // reporter’s email
  };
};

/** When creating a new complaint via UI */
export type NewComplaintInput = {
  title: string;
  body: string;
  departmentId: string; // subject department
  reporter: Reporter;
};
