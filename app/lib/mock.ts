import type {
  Complaint,
  ComplaintStatus,
  Department,
  User,
  Reporter,
  ReviewCycle,
  AssigneeLetter,
  ReturnInfo,
} from "./types";

/* ─────────────────────────── simple client-side persistence ─────────────────────────── */
const STORAGE_KEY = "mock-db-v1";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function persist() {
  if (!isBrowser()) return;
  const payload = JSON.stringify({ users, departments, complaints });
  localStorage.setItem(STORAGE_KEY, payload);
}

function hydrate() {
  if (!isBrowser()) return;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    // first run → store the seed so subsequent refreshes keep mutations
    persist();
    return;
  }
  try {
    const parsed = JSON.parse(raw) as {
      users: User[];
      departments: Department[];
      complaints: Complaint[];
    };
    if (Array.isArray(parsed.users)) {
      (users as unknown as User[]).splice(0, users.length, ...parsed.users);
    }
    if (Array.isArray(parsed.departments)) {
      (departments as unknown as Department[]).splice(
        0,
        departments.length,
        ...parsed.departments
      );
    }
    if (Array.isArray(parsed.complaints)) {
      (complaints as unknown as Complaint[]).splice(
        0,
        complaints.length,
        ...parsed.complaints
      );
    }
  } catch {
    // ignore corrupted storage; keep seed
    persist();
  }
}

/* ---------------- USERS ---------------- */
export const users: User[] = [
  { id: "u0", name: "Ada Admin", role: "ADMIN", departmentId: "d1" },
  { id: "u1", name: "Mia Manager", role: "MANAGER", departmentId: "d1" },
  { id: "u2", name: "Eli Employee", role: "EMPLOYEE", departmentId: "d1" },
  { id: "u3", name: "Ava Agent", role: "EMPLOYEE", departmentId: "d1" },
  { id: "u4", name: "Noa Manager", role: "MANAGER", departmentId: "d3" },
  { id: "u5", name: "Ben Builder", role: "EMPLOYEE", departmentId: "d3" },
  { id: "u6", name: "Lior Tech", role: "EMPLOYEE", departmentId: "d2" },
  { id: "u7", name: "Pnina Principal", role: "PRINCIPAL", departmentId: "d1" },
  { id: "u8", name: "Erez Engineer", role: "EMPLOYEE", departmentId: "d2" },
  { id: "u9", name: "Dana Designer", role: "EMPLOYEE", departmentId: "d1" },
];

/* ---------------- DEPARTMENTS ---------------- */
export const departments: Department[] = [
  {
    id: "d1",
    name: "Support",
    managerUserId: "u1",
    members: ["u1", "u2", "u3", "u9"],
  },
  {
    id: "d2",
    name: "IT Services",
    managerUserId: "u1",
    members: ["u1", "u6", "u8"],
  },
  { id: "d3", name: "Maintenance", managerUserId: "u4", members: ["u4", "u5"] },
];

/* ---------------- HELPERS ---------------- */
function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
function nowISO() {
  return new Date().toISOString();
}
function randomId(prefix: string) {
  return prefix + Math.random().toString(36).slice(2, 7);
}

/* ---------------- REPORTERS ---------------- */
const reporters: Reporter[] = [
  {
    type: "STAFF",
    fullName: "Dana Staff",
    email: "dana@school.edu",
    phone: "050-1112233",
    jobTitle: "מורה למדעים",
    departmentId: "d1",
  },
  {
    type: "STAFF",
    fullName: "Rami Teacher",
    email: "rami@school.edu",
    phone: "050-2223344",
    jobTitle: "מחנך",
    departmentId: "d2",
  },
  {
    type: "PARENT_STUDENT",
    fullName: "Yossi Parent",
    email: "yossi@gmail.com",
    phone: "052-3345566",
    grade: "ח'",
    classNumber: "2",
  },
  {
    type: "PARENT_STUDENT",
    fullName: "Maya Cohen",
    email: "maya.parent@gmail.com",
    phone: "054-6677889",
    grade: "ט'",
    classNumber: "1",
  },
  {
    type: "PARENT_STUDENT",
    fullName: "Amit Levi",
    email: "amit.levi@gmail.com",
    phone: "054-5543211",
    grade: "י'",
    classNumber: "3",
  },
];

/* ---------------- COMPLAINTS (seed) ---------------- */
export const complaints: Complaint[] = [
  {
    id: "c1",
    title: "המורה לא מחזירה מבחנים בזמן",
    body: "עברו שבועיים מאז המבחן האחרון והתלמידים עדיין לא קיבלו ציונים.",
    status: "OPEN",
    departmentId: "d1",
    assigneeUserId: null,
    createdById: null,
    reporter: reporters[2],
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
    messages: [],
  },
  {
    id: "c2",
    title: "תקלה במערכת הזנת ציונים",
    body: "לא ניתן להזין ציונים דרך פורטל המורים.",
    status: "ASSIGNED",
    departmentId: "d2",
    assigneeUserId: "u6",
    createdById: null,
    reporter: reporters[0],
    createdAt: daysAgo(3),
    updatedAt: daysAgo(2),
    messages: [
      {
        id: "m2",
        authorId: "u6",
        body: "בודק הרשאות וקריאות לוגין מול ה-SSO.",
        createdAt: daysAgo(2.5),
      },
    ],
  },
  {
    id: "c3",
    title: "המזגן בכיתה אינו עובד",
    body: "אין מזגן בכיתה ט'2, התלמידים סובלים מחום רב.",
    status: "AWAITING_PRINCIPAL_REVIEW",
    departmentId: "d3",
    assigneeUserId: "u5",
    createdById: null,
    reporter: reporters[3],
    createdAt: daysAgo(6),
    updatedAt: daysAgo(0.5),
    messages: [
      {
        id: "m3",
        authorId: "u5",
        body: "בוצע ניקוי פילטרים והוזמן טכנאי חיצוני.",
        createdAt: daysAgo(1),
      },
    ],
  },
  {
    id: "c4",
    title: "בקשה להחזיר ציוד שנלקח",
    body: "הציוד נלקח מהמחסן לצורכי הוראה ולא הוחזר.",
    status: "CLOSED",
    departmentId: "d1",
    assigneeUserId: "u2",
    createdById: null,
    reporter: reporters[0],
    createdAt: daysAgo(10),
    updatedAt: daysAgo(1),
    messages: [
      {
        id: "m4",
        authorId: "u2",
        body: "הציוד הוחזר במלואו.",
        createdAt: daysAgo(1.5),
      },
    ],
    principalReview: {
      justified: true,
      summary: "הפנייה מוצדקת – הציוד הוחזר ונשלח מייל סיכום.",
      principalUserId: "u7",
      reviewedAt: daysAgo(1),
    },
    notificationEmail: {
      sent: true,
      sentAt: daysAgo(1),
      to: "dana@school.edu",
    },
  },
  {
    id: "c5",
    title: "רעש במסדרון בזמן שיעורים",
    body: "תלמידים מסתובבים ומדברים בקול רם ליד כיתות הלימוד.",
    status: "OPEN",
    departmentId: "d1",
    assigneeUserId: null,
    createdById: null,
    reporter: reporters[3],
    createdAt: daysAgo(0.5),
    updatedAt: daysAgo(0.3),
    messages: [],
  },
  {
    id: "c6",
    title: "מחשבי מעבדה איטיים מאוד",
    body: "חמישה מחשבים עולים לאט מאוד ומפריעים לשיעור.",
    status: "IN_PROGRESS",
    departmentId: "d2",
    assigneeUserId: "u8",
    createdById: null,
    reporter: reporters[1],
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
    messages: [
      {
        id: "m6",
        authorId: "u8",
        body: "ביצעתי בדיקת דיסקים והחלפתי SSD למחשב אחד.",
        createdAt: daysAgo(1),
      },
    ],
  },
  {
    id: "c7",
    title: "דליפה בברזים בחדר מורים",
    body: "הברזים מטפטפים וגורמים להצטברות מים ליד הכיור.",
    status: "ASSIGNED",
    departmentId: "d3",
    assigneeUserId: "u5",
    createdById: null,
    reporter: reporters[0],
    createdAt: daysAgo(5),
    updatedAt: daysAgo(3),
    messages: [
      {
        id: "m7",
        authorId: "u5",
        body: "הוחלפו גומיות לבדיקה נוספת מחר.",
        createdAt: daysAgo(2),
      },
    ],
  },
  {
    id: "c8",
    title: "חוסר זמינות בחדר מחשבים",
    body: "אין מספיק עמדות לתלמידים בקורס רובוטיקה.",
    status: "OPEN",
    departmentId: "d2",
    assigneeUserId: null,
    createdById: null,
    reporter: reporters[2],
    createdAt: daysAgo(2),
    updatedAt: daysAgo(2),
    messages: [],
  },
  {
    id: "c9",
    title: "כיסאות שבורים בכיתה ח'3",
    body: "שלושה כיסאות נשברו – יש חשש לבטיחות.",
    status: "IN_PROGRESS",
    departmentId: "d3",
    assigneeUserId: "u5",
    createdById: null,
    reporter: reporters[3],
    createdAt: daysAgo(4),
    updatedAt: daysAgo(1),
    messages: [
      {
        id: "m9",
        authorId: "u5",
        body: "הוזמנו חלקי חילוף, התיקון צפוי להסתיים מחר.",
        createdAt: daysAgo(1),
      },
    ],
  },
  {
    id: "c10",
    title: "אפליקציית נוכחות נתקעת",
    body: "האפליקציה קורסת בזמן סימון נוכחות.",
    status: "AWAITING_PRINCIPAL_REVIEW",
    departmentId: "d2",
    assigneeUserId: "u6",
    createdById: null,
    reporter: reporters[1],
    createdAt: daysAgo(3),
    updatedAt: daysAgo(0.5),
    messages: [
      {
        id: "m10",
        authorId: "u6",
        body: "נשלח עדכון גרסה – ממתין לאישור.",
        createdAt: daysAgo(0.5),
      },
    ],
  },
  {
    id: "c11",
    title: "חוסר ציוד בכיתה ט'1",
    body: "אין מספיק טושים ולוח מחוק.",
    status: "OPEN",
    departmentId: "d1",
    assigneeUserId: null,
    createdById: null,
    reporter: reporters[4],
    createdAt: daysAgo(0.7),
    updatedAt: daysAgo(0.5),
    messages: [],
  },
  {
    id: "c12",
    title: "בעיית חיבור אינטרנט בכיתת מחשבים",
    body: "ה-WiFi מתנתק כל כמה דקות.",
    status: "IN_PROGRESS",
    departmentId: "d2",
    assigneeUserId: "u6",
    createdById: null,
    reporter: reporters[0],
    createdAt: daysAgo(4),
    updatedAt: daysAgo(1),
    messages: [
      {
        id: "m12",
        authorId: "u6",
        body: "נמצא נתב תקול – הוחלף בהצלחה.",
        createdAt: daysAgo(1),
      },
    ],
  },
  {
    id: "c13",
    title: "בקשה לשיפוץ חדר מורים",
    body: "החדר קטן מדי ומצריך סידור מחדש.",
    status: "ASSIGNED",
    departmentId: "d3",
    assigneeUserId: "u5",
    createdById: null,
    reporter: reporters[2],
    createdAt: daysAgo(7),
    updatedAt: daysAgo(5),
    messages: [],
  },
  {
    id: "c14",
    title: "מזגן חם מדי בחורף",
    body: "בכיתה י'2 המזגן מחמם יתר על המידה.",
    status: "OPEN",
    departmentId: "d3",
    assigneeUserId: null,
    createdById: null,
    reporter: reporters[3],
    createdAt: daysAgo(0.5),
    updatedAt: daysAgo(0.3),
    messages: [],
  },
  {
    id: "c15",
    title: "בקשה להחלפת מחשב נייד ישן",
    body: "המחשב הנוכחי איטי מאוד.",
    status: "AWAITING_PRINCIPAL_REVIEW",
    departmentId: "d2",
    assigneeUserId: "u8",
    createdById: null,
    reporter: reporters[0],
    createdAt: daysAgo(5),
    updatedAt: daysAgo(0.4),
    messages: [
      {
        id: "m15",
        authorId: "u8",
        body: "הוחלט להחליף מחשב – ממתין לאישור הנהלה.",
        createdAt: daysAgo(0.4),
      },
    ],
  },
  {
    id: "c16",
    title: "בקשה למערכת מיזוג חדשה",
    body: "המערכת הישנה ברעש חזק ומפסיקה לפעול.",
    status: "CLOSED",
    departmentId: "d3",
    assigneeUserId: "u5",
    createdById: null,
    reporter: reporters[4],
    createdAt: daysAgo(10),
    updatedAt: daysAgo(1),
    messages: [
      {
        id: "m16",
        authorId: "u5",
        body: "בוצעה התקנה של מערכת חדשה.",
        createdAt: daysAgo(1.5),
      },
    ],
    principalReview: {
      justified: true,
      summary: "התקלה טופלה במלואה.",
      principalUserId: "u7",
      reviewedAt: daysAgo(1),
    },
    notificationEmail: {
      sent: true,
      sentAt: daysAgo(1),
      to: "amit.levi@gmail.com",
    },
  },
  {
    id: "c17",
    title: "בקשה להוספת מצלמות ביטחון",
    body: "הורים ביקשו מצלמות באיזור המסדרון הראשי.",
    status: "OPEN",
    departmentId: "d1",
    assigneeUserId: null,
    createdById: null,
    reporter: reporters[3],
    createdAt: daysAgo(0.2),
    updatedAt: daysAgo(0.1),
    messages: [],
  },
  {
    id: "c18",
    title: "בעיות תאורה במגרש הספורט",
    body: "חלק מהזרקורים לא עובדים בערב.",
    status: "ASSIGNED",
    departmentId: "d3",
    assigneeUserId: "u5",
    createdById: null,
    reporter: reporters[2],
    createdAt: daysAgo(3),
    updatedAt: daysAgo(1),
    messages: [
      {
        id: "m18",
        authorId: "u5",
        body: "הוזמן חשמלאי לבדיקה – צפוי להגיע היום.",
        createdAt: daysAgo(1),
      },
    ],
  },
  {
    id: "c19",
    title: "מערכת התראות לא מתפקדת",
    body: "לא מתקבלות התראות על פניות חדשות.",
    status: "IN_PROGRESS",
    departmentId: "d2",
    assigneeUserId: "u6",
    createdById: null,
    reporter: reporters[0],
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
    messages: [
      {
        id: "m19",
        authorId: "u6",
        body: "בודק הרשאות API מול מערכת הדיוור.",
        createdAt: daysAgo(1),
      },
    ],
  },
  {
    id: "c20",
    title: "חוסר בעמדות טעינה לטלפונים",
    body: "אין מספיק עמדות טעינה באזור הכיתות.",
    status: "OPEN",
    departmentId: "d1",
    assigneeUserId: null,
    createdById: null,
    reporter: reporters[2],
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    messages: [],
  },
];

/* hydrate from localStorage on module import */
hydrate();

/* ---------------- BASIC GETTERS ---------------- */
export const getUser = (id: string) => users.find((u) => u.id === id)!;
export const getDept = (id: string) => departments.find((d) => d.id === id)!;
export const getComplaint = (id: string) =>
  complaints.find((c) => c.id === id)!;
export const listDeptMembers = (deptId: string) =>
  users.filter((u) => u.departmentId === deptId);

/** Assignable = EMPLOYEEs in dept + that dept’s MANAGER (so manager can assign self) */
export function assignableUsersForDept(deptId: string): User[] {
  const inDept = users.filter((u) => u.departmentId === deptId);
  const dept = departments.find((d) => d.id === deptId);
  const mgr = dept ? users.find((u) => u.id === dept.managerUserId) : undefined;
  const employees = inDept.filter((u) => u.role === "EMPLOYEE");
  const map = new Map<string, User>();
  for (const u of employees) map.set(u.id, u);
  if (mgr) map.set(mgr.id, mgr);
  return Array.from(map.values());
}

/* ---------------- IN-MEMORY MUTATORS (DB-like) ---------------- */
function patchComplaint(id: string, patch: Partial<Complaint>): Complaint {
  const idx = complaints.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Complaint not found");
  complaints[idx] = { ...complaints[idx], ...patch, updatedAt: nowISO() };
  persist();
  return complaints[idx];
}

/** Admin/Manager assigns (or clears) an assignee */
export function assignComplaint(
  complaintId: string,
  assigneeUserId?: string | null
) {
  const c = patchComplaint(complaintId, {
    assigneeUserId: assigneeUserId ?? null,
    status: (assigneeUserId ? "ASSIGNED" : "OPEN") as ComplaintStatus,
  });

  // Optional: clear returnInfo on (re)assignment
  if (assigneeUserId) {
    c.returnInfo = null;
    persist();
  }
  return c;
}

/** Admin/Principal can change department; optionally clear assignee if not in new dept */
export function changeDepartment(
  complaintId: string,
  newDepartmentId: string,
  {
    clearAssigneeIfNotInDept = true,
  }: { clearAssigneeIfNotInDept?: boolean } = {}
) {
  const c = getComplaint(complaintId);
  c.departmentId = newDepartmentId;

  if (clearAssigneeIfNotInDept && c.assigneeUserId) {
    const allowed = assignableUsersForDept(newDepartmentId).some(
      (u) => u.id === c.assigneeUserId
    );
    if (!allowed) c.assigneeUserId = null;
  }
  c.updatedAt = nowISO();
  persist();
  return c;
}

/** Assignee saves a draft letter (does not submit) */
export function saveAssigneeLetter(
  complaintId: string,
  authorUserId: string,
  body: string
) {
  const c = getComplaint(complaintId);
  if (!c.assigneeUserId || c.assigneeUserId !== authorUserId) {
    throw new Error("Only the assigned user can save the letter");
  }
  const letter: AssigneeLetter = {
    body: body.trim(),
    authorUserId,
    updatedAt: nowISO(),
    submittedAt: undefined,
  };
  c.assigneeLetter = letter;
  c.status = "IN_PROGRESS";
  c.returnInfo = null; // clear any previous return banner
  c.updatedAt = nowISO();
  persist();
  return c;
}

/** Assignee submits the letter for principal review */
export function submitForPrincipalReview(
  complaintId: string,
  authorUserId: string
) {
  const c = getComplaint(complaintId);
  if (!c.assigneeUserId || c.assigneeUserId !== authorUserId) {
    throw new Error("Only the assigned user can submit");
  }
  if (!c.assigneeLetter || !c.assigneeLetter.body.trim()) {
    throw new Error("Cannot submit an empty letter");
  }
  c.assigneeLetter.submittedAt = nowISO();
  c.status = "AWAITING_PRINCIPAL_REVIEW";

  const cycle: ReviewCycle = {
    submittedAt: c.assigneeLetter.submittedAt,
    submittedByUserId: authorUserId,
  };
  c.reviewCycles = [...(c.reviewCycles ?? []), cycle];

  c.updatedAt = nowISO();
  persist();
  return c;
}

/** Principal returns to assignee for redo (with reason) */
export function principalReturnForRedo(
  complaintId: string,
  principalUserId: string,
  reason: string
) {
  const c = getComplaint(complaintId);
  if (c.status !== "AWAITING_PRINCIPAL_REVIEW") {
    throw new Error("Return allowed only from AWAITING_PRINCIPAL_REVIEW");
  }
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("Return reason is required");
  const ts = nowISO();

  // Update latest cycle as returned
  const cycles = c.reviewCycles ?? [];
  if (cycles.length > 0) {
    const last = cycles[cycles.length - 1];
    last.returnedAt = ts;
    last.returnReason = trimmed;
    last.returnedByUserId = principalUserId;
  }
  c.reviewCycles = cycles;

  // Update current banner with count
  const prevCount = c.returnInfo?.count ?? 0;
  const ret: ReturnInfo = {
    count: prevCount + 1,
    reason: trimmed,
    returnedAt: ts,
    returnedByUserId: principalUserId,
  };
  c.returnInfo = ret;

  c.status = "IN_PROGRESS";
  c.principalReview = undefined;
  c.updatedAt = ts;
  persist();
  return c;
}

/** Principal approves & closes */
export function principalApproveAndClose(
  complaintId: string,
  principalUserId: string,
  justified: boolean,
  summary: string
) {
  const c = getComplaint(complaintId);
  if (c.status !== "AWAITING_PRINCIPAL_REVIEW") {
    throw new Error("Approval allowed only from AWAITING_PRINCIPAL_REVIEW");
  }
  const ts = nowISO();

  // Close cycle as approved
  const cycles = c.reviewCycles ?? [];
  if (cycles.length > 0) {
    const last = cycles[cycles.length - 1];
    last.approvedAt = ts;
    last.principalUserId = principalUserId;
    last.justified = justified;
    last.summary = summary.trim();
  }
  c.reviewCycles = cycles;

  c.principalReview = {
    justified,
    summary: summary.trim(),
    principalUserId,
    reviewedAt: ts,
  };
  c.returnInfo = null;
  c.status = "CLOSED";
  c.notificationEmail = { sent: true, sentAt: ts, to: c.reporter.email };
  c.updatedAt = ts;
  persist();
  return c;
}

/* ---------------- OPTIONAL UTILS ---------------- */
export function addMessage(
  complaintId: string,
  authorId: string,
  body: string
) {
  const c = getComplaint(complaintId);
  c.messages = [
    ...c.messages,
    { id: randomId("m"), authorId, body, createdAt: nowISO() },
  ];
  c.updatedAt = nowISO();
  persist();
  return c;
}

export function setStatus(complaintId: string, status: ComplaintStatus) {
  const res = patchComplaint(complaintId, { status });
  persist();
  return res;
}
