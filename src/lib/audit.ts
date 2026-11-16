import { db } from "./db";
import type { Prisma } from "@prisma/client";
export async function audit(actorId: string | null, action: string, entityType?: string, entityId?: string,
  metadata: Prisma.InputJsonValue = {}, ip?: string | null) {
  await db.auditLog.create({ data: { actorId, action, entityType, entityId, metadata, ip: ip ?? null } });
}
