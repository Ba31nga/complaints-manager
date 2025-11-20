import { google, drive_v3 } from "googleapis";
import { Readable } from "node:stream";

// Service Account auth (mirrors sheets.ts)
const SA_EMAIL = process.env.GOOGLE_SA_CLIENT_EMAIL;
const SA_KEY_RAW = process.env.GOOGLE_SA_PRIVATE_KEY;
const SA_KEY = SA_KEY_RAW && SA_KEY_RAW.includes("\\n")
  ? SA_KEY_RAW.replace(/\\n/g, "\n")
  : SA_KEY_RAW;

export const DRIVE_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();

let driveClient: drive_v3.Drive | null = null;

export function getDrive(): drive_v3.Drive {
  if (!SA_EMAIL || !SA_KEY) {
    throw new Error("Missing GOOGLE_SA_CLIENT_EMAIL or GOOGLE_SA_PRIVATE_KEY");
  }
  if (driveClient) return driveClient;

  // drive.file allows the SA to create/manage files it creates or has been granted access to.
  const auth = new google.auth.JWT({
    email: SA_EMAIL,
    key: SA_KEY,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

export async function uploadPdfToDrive(args: {
  buffer: Buffer;
  filename: string;
  folderId: string;
}): Promise<{ id: string; webViewLink?: string; webContentLink?: string } | null> {
  const { buffer, filename, folderId } = args;
  if (!buffer?.length || !filename || !folderId) return null;

  const drive = getDrive();

  const res = await drive.files.create({
    requestBody: {
      name: filename,
      parents: [folderId],
      mimeType: "application/pdf",
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(buffer),
    },
    fields: "id, webViewLink, webContentLink",
  });

  const id = res.data.id || "";
  return id
    ? { id, webViewLink: res.data.webViewLink || undefined, webContentLink: res.data.webContentLink || undefined }
    : null;
}


