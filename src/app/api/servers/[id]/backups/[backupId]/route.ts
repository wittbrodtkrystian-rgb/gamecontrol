import { route } from "@/lib/api";
import { deleteBackup } from "@/server/servers";
export const DELETE = route<{ id: string; backupId: string }>({}, async ({ user, params }) => deleteBackup(user, params.id, params.backupId));
