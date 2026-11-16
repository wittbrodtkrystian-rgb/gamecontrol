import { route } from "@/lib/api";
import { restoreBackup } from "@/server/servers";
export const POST = route<{ id: string; backupId: string }>({ limit: { key: "backup-restore", max: 5, windowSec: 600 } }, async ({ user, params }) => restoreBackup(user, params.id, params.backupId));
