import { google, docs_v1, drive_v3 } from "googleapis";

// Service Account auth (reuse env from drive.ts style)
const SA_EMAIL = process.env.GOOGLE_SA_CLIENT_EMAIL;
const SA_KEY_RAW = process.env.GOOGLE_SA_PRIVATE_KEY;
const SA_KEY = SA_KEY_RAW && SA_KEY_RAW.includes("\\n")
  ? SA_KEY_RAW.replace(/\\n/g, "\n")
  : SA_KEY_RAW;

let docsClient: docs_v1.Docs | null = null;
let driveClient: drive_v3.Drive | null = null;

function getAuth() {
  if (!SA_EMAIL || !SA_KEY) {
    throw new Error("Missing GOOGLE_SA_CLIENT_EMAIL or GOOGLE_SA_PRIVATE_KEY");
  }
  // Need both Docs and Drive scopes: copy, edit, export
  return new google.auth.JWT({
    email: SA_EMAIL,
    key: SA_KEY,
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });
}

export function getDocs(): docs_v1.Docs {
  if (docsClient) return docsClient;
  const auth = getAuth();
  docsClient = google.docs({ version: "v1", auth });
  return docsClient;
}

export function getDriveForDocs(): drive_v3.Drive {
  if (driveClient) return driveClient;
  const auth = getAuth();
  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}


