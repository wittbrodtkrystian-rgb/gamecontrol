import { route } from "@/lib/api";
import { db } from "@/lib/db";
import { createBackup, getServerFor } from "@/server/servers";
export const GET = route<{ id: string }>({}, async ({ user, params }) => { await getServerFor(user, params.id); return db.backup.findMany({ where: { serverId: params.id }, orderBy: { createdAt: "desc" } }); });
export const POST = route<{ id: string }>({ limit: { key: "backup", max: 10, windowSec: 600 } }, async ({ user, params }) => createBackup(user, params.id));
