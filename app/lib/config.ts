import { z } from "zod";

const EnvSchema = z.object({
  GMAIL_USER: z.string().min(1),
  GMAIL_APP_PASSWORD: z.string().min(1),
  MAIL_FROM: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),

  GOOGLE_SA_CLIENT_EMAIL: z.string().min(1),
  GOOGLE_SA_PRIVATE_KEY: z.string().min(1),

  GOOGLE_SHEETS_ID: z.string().min(1),
  GOOGLE_SHEETS_COMPLAINTS_ID: z.string().min(1),

  GOOGLE_USERS_TAB: z.string().optional(),
  GOOGLE_DEPARTMENTS_TAB: z.string().optional(),
  GOOGLE_ROLES_TAB: z.string().optional(),
  GOOGLE_COMPLAINTS_TAB: z.string().optional(),

  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
  GOOGLE_DOCS_TEMPLATE_ID: z.string().optional(),

  GOOGLE_FORM_ID: z.string().optional(),
  entryID: z.string().optional(),
});

function normalizePrivateKey(key: string) {
  return key.includes("\\n") ? key.replace(/\\n/g, "\n") : key;
}

const raw = {
  GMAIL_USER: process.env.GMAIL_USER || "",
  GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD || "",
  MAIL_FROM: process.env.MAIL_FROM,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,

  GOOGLE_SA_CLIENT_EMAIL: process.env.GOOGLE_SA_CLIENT_EMAIL || "",
  GOOGLE_SA_PRIVATE_KEY: process.env.GOOGLE_SA_PRIVATE_KEY
    ? normalizePrivateKey(process.env.GOOGLE_SA_PRIVATE_KEY)
    : "",

  GOOGLE_SHEETS_ID: process.env.GOOGLE_SHEETS_ID || "",
  GOOGLE_SHEETS_COMPLAINTS_ID: process.env.GOOGLE_SHEETS_COMPLAINTS_ID || "",

  GOOGLE_USERS_TAB: process.env.GOOGLE_USERS_TAB,
  GOOGLE_DEPARTMENTS_TAB: process.env.GOOGLE_DEPARTMENTS_TAB,
  GOOGLE_ROLES_TAB: process.env.GOOGLE_ROLES_TAB,
  GOOGLE_COMPLAINTS_TAB: process.env.GOOGLE_COMPLAINTS_TAB,

  GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID,
  GOOGLE_DOCS_TEMPLATE_ID: process.env.GOOGLE_DOCS_TEMPLATE_ID,

  GOOGLE_FORM_ID: process.env.GOOGLE_FORM_ID,
  entryID: process.env.entryID,
};

export const config = EnvSchema.parse(raw);

export type AppConfig = typeof config;
