import { getDocs, getDriveForDocs } from "@/app/lib/docs";

export type DocsTemplateData = Record<string, string>;

export async function generatePdfFromGoogleDoc(params: {
  templateId: string;
  filename: string;
  data: DocsTemplateData;
  cleanup?: boolean;
}): Promise<{ buffer: Buffer; fileId: string }>{
  const { templateId, filename, data, cleanup = true } = params;

  const drive = getDriveForDocs();
  const docs = getDocs();

  // 1) Copy template
  const copyRes = await drive.files.copy({
    fileId: templateId,
    requestBody: { name: filename },
    fields: "id",
  });
  const newFileId = copyRes.data.id as string;

  // 2) Replace placeholders
  const requests = Object.entries(data).map(([placeholder, value]) => ({
    replaceAllText: {
      containsText: { text: `{{${placeholder}}}`, matchCase: false },
      replaceText: value,
    },
  }));
  await docs.documents.batchUpdate({
    documentId: newFileId,
    requestBody: { requests },
  });

  // 3) Export as PDF
  const exportRes = await drive.files.export(
    { fileId: newFileId, mimeType: "application/pdf" },
    { responseType: "arraybuffer" }
  );
  const buffer = Buffer.from(exportRes.data as ArrayBuffer);

  // 4) Optional cleanup
  if (cleanup) {
    try { await drive.files.delete({ fileId: newFileId }); } catch {}
  }

  return { buffer, fileId: newFileId };
}


