import { z } from "zod";
import type { Complaint } from "@/app/lib/types";

const MessageSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

const ReturnInfoSchema = z.object({
  count: z.number(),
  reason: z.string(),
  returnedAt: z.string(),
  returnedByUserId: z.string(),
});

export function validatePatchOrThrow(
  patch: unknown
): asserts patch is Partial<Complaint> {
  if (patch == null || typeof patch !== "object") return;
  const p = patch as Record<string, unknown>;

  if (p.messages !== undefined) {
    const arr = p.messages as unknown;
    if (!Array.isArray(arr)) throw new Error("messages must be an array");
    for (const m of arr) {
      const res = MessageSchema.safeParse(m);
      if (!res.success) throw new Error("invalid message shape");
    }
  }

  if (p.returnInfo !== undefined && p.returnInfo !== null) {
    const res = ReturnInfoSchema.safeParse(p.returnInfo);
    if (!res.success) throw new Error("invalid returnInfo shape");
  }
}
