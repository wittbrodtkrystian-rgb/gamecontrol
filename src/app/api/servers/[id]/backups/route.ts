import { route } from "@/lib/api";
import { createBackup, listBackups } from "@/server/servers";
export const GET = route<{ id: string }>({}, async ({ user, params }) => listBackups(user, params.id));
export const POST = route<{ id: string }>({ limit: { key: "backup", max: 10, windowSec: 600 } }, async ({ user, params }) => createBackup(user, params.id));
