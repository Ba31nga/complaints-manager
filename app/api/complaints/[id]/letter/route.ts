import { Readable } from "node:stream";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { rowToComplaint } from "@/app/lib/mappers/complaints";
import type { Complaint } from "@/app/lib/types";
import { DRIVE_FOLDER_ID, getDrive } from "@/app/lib/drive";
import {
  getAllComplaintRows,
  locateComplaintRow,
  unwrapParams,
  type CtxMaybePromise,
} from "@/app/lib/services/complaints/complaints.sheets";
import { normalizeId, norm } from "@/app/lib/utils";
import { canReadComplaint } from "@/app/lib/services/complaints/complaints.access";
import type { drive_v3 } from "googleapis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ComplaintGuardResult =
  | { ok: true; complaint: Complaint }
  | { ok: false; status: number; error: string };

async function assertCanReadComplaint(
  ctx: CtxMaybePromise
): Promise<ComplaintGuardResult> {
  try {
    const { id } = await unwrapParams(ctx);
    const values = await getAllComplaintRows();
    const wanted = normalizeId(id);
    const loc = locateComplaintRow(
      values.map((row) => row.map((cell) => (cell ?? "").toString())),
      wanted
    );
    const found = loc.row;
    if (!found) {
      return { ok: false, status: 404, error: "Complaint not found" };
    }
    const complaint = rowToComplaint(found);
    if (!complaint) {
      return { ok: false, status: 404, error: "Complaint not found" };
    }

    const session = await getServerSession(authOptions);
    if (!session) {
      return { ok: false, status: 401, error: "Unauthenticated" };
    }
    const user = session.user as
      | { id?: string; department?: string; role?: string }
      | undefined;
    if (!canReadComplaint(user, complaint)) {
      return { ok: false, status: 403, error: "Forbidden" };
    }

    return { ok: true, complaint };
  } catch (error) {
    console.error("[complaint letter] guard failed:", error);
    return { ok: false, status: 500, error: "Failed to load complaint" };
  }
}

function nodeToWebReadable(stream: Readable): ReadableStream<Uint8Array> {
  if (typeof Readable.toWeb === "function") {
    return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
  }
  return new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });
}

function escapeForDriveQuery(value: string) {
  return value.replace(/(['\\])/g, "\\$1");
}

type DriveFolderScope = { driveId?: string | null };
const folderScopeCache = new Map<string, DriveFolderScope>();

async function getFolderScope(
  drive: drive_v3.Drive,
  folderId: string
): Promise<DriveFolderScope> {
  if (folderScopeCache.has(folderId)) {
    return folderScopeCache.get(folderId)!;
  }
  try {
    const res = await drive.files.get({
      fileId: folderId,
      fields: "id, driveId",
      supportsAllDrives: true,
    });
    const scope = { driveId: res.data.driveId || null };
    folderScopeCache.set(folderId, scope);
    return scope;
  } catch (error) {
    console.warn(
      "[complaint letter] failed to read folder metadata; assuming personal drive",
      error instanceof Error ? error.message : error
    );
    const scope = { driveId: null };
    folderScopeCache.set(folderId, scope);
    return scope;
  }
}

function buildListParams(scope: DriveFolderScope): Pick<
  drive_v3.Params$Resource$Files$List,
  | "fields"
  | "pageSize"
  | "includeItemsFromAllDrives"
  | "supportsAllDrives"
  | "driveId"
  | "corpora"
  | "spaces"
> {
  return {
    fields: "files(id, name, mimeType, modifiedTime, size)",
    pageSize: 1,
    includeItemsFromAllDrives: true,
    supportsAllDrives: true,
    spaces: "drive",
    ...(scope.driveId
      ? { driveId: scope.driveId, corpora: "drive" as const }
      : { corpora: "allDrives" as const }),
  };
}

async function findLetterFile(params: {
  drive: drive_v3.Drive;
  folderId: string;
  targetName: string;
  scope: DriveFolderScope;
}) {
  const { drive, folderId, targetName, scope } = params;
  const baseNoExt = targetName.replace(/\.pdf$/i, "");
  const lower = targetName.toLowerCase();
  const lowerNoExt = lower.replace(/\.pdf$/i, "");
  const normalizedBase = normalizeId(baseNoExt);
  const normalizedLower = norm(baseNoExt);
  const candidateNames = Array.from(
    new Set(
      [
        targetName,
        `${baseNoExt}.pdf`,
        `${lowerNoExt}.pdf`,
        `${normalizedBase}.pdf`,
        `${normalizedLower}.pdf`,
      ].filter(Boolean)
    )
  );
  const baseParams = buildListParams(scope);

  const tryList = async (q: string, pageSize = 1) => {
    try {
      return await drive.files.list({
        ...baseParams,
        pageSize,
        q,
      });
    } catch (error) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: number }).code === 404
      ) {
        console.warn(
          "[complaint letter] list query returned 404; treating as no results"
        );
        return { data: { files: [] } };
      }
      throw error;
    }
  };

  for (const candidate of candidateNames) {
    const escaped = escapeForDriveQuery(candidate);
    const list = await tryList(
      `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false and name = '${escaped}'`
    );
    const file = list.data.files?.[0];
    if (file?.id) return file;
  }

  const fallbackBase = escapeForDriveQuery(lowerNoExt || baseNoExt);
  const fallbackList = await tryList(
    `'${folderId}' in parents and mimeType = 'application/pdf' and trashed = false and name contains '${fallbackBase}'`,
    10
  );
  const normalizedTarget = candidateNames
    .map((n) => n.toLowerCase())
    .find(Boolean);
  const fallbackFile = fallbackList.data.files?.find(
    (file) => (file.name || "").toLowerCase() === normalizedTarget
  );
  if (fallbackFile) return fallbackFile;
  if (fallbackList.data.files?.[0]) return fallbackList.data.files[0];

  const sharedList = await tryList(
    `sharedWithMe and mimeType = 'application/pdf' and trashed = false and name contains '${fallbackBase}'`,
    20
  );
  const sharedMatch = sharedList.data.files?.find((file) => {
    const parents = Array.isArray((file as { parents?: string[] }).parents)
      ? ((file as { parents?: string[] }).parents as string[])
      : [];
    return (
      parents.includes(folderId) ||
      (file.name || "").toLowerCase() === normalizedTarget
    );
  });
  return sharedMatch || sharedList.data.files?.[0] || null;
}

export async function GET(req: Request, ctx: CtxMaybePromise) {
  const guard = await assertCanReadComplaint(ctx);
  if (!guard.ok) {
    return Response.json(
      { error: guard.error },
      { status: guard.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!DRIVE_FOLDER_ID) {
    return Response.json(
      { error: "GOOGLE_DRIVE_FOLDER_ID is not configured" },
      { status: 500 }
    );
  }

  const { complaint } = guard;
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode");

  const drive = getDrive();
  const targetName = `${complaint.id}.pdf`;
  const folderScope = await getFolderScope(drive, DRIVE_FOLDER_ID);
  try {
    const file = await findLetterFile({
      drive,
      folderId: DRIVE_FOLDER_ID,
      targetName,
      scope: folderScope,
    });
    if (!file?.id) {
      const status = 404;
      if (mode === "meta") {
        return Response.json(
          { data: { exists: false } },
          { status: 200, headers: { "Cache-Control": "no-store" } }
        );
      }
      return Response.json(
        { error: "Letter PDF not found" },
        { status, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (mode === "meta") {
      return Response.json(
        {
          data: {
            exists: true,
            fileName: file.name,
            mimeType: file.mimeType,
            modifiedTime: file.modifiedTime,
            size: file.size ? Number(file.size) : undefined,
          },
        },
        { status: 200, headers: { "Cache-Control": "no-store" } }
      );
    }

    const pdf = await drive.files.get(
      {
        fileId: file.id,
        alt: "media",
        supportsAllDrives: true,
      },
      { responseType: "stream" }
    );

    const pdfStream = pdf.data as Readable;
    const webStream = nodeToWebReadable(pdfStream);
    const fileName = file.name || targetName;

    return new Response(webStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[complaint letter] failed to read Drive file:", error);
    return Response.json(
      { error: "Failed to load letter PDF" },
      { status: 500 }
    );
  }
}


