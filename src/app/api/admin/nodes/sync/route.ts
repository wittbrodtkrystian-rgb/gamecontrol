import { route } from "@/lib/api";
import { syncNodes } from "@/server/nodes-sync";
export const POST = route({ roles: ["ADMIN"], limit: { key: "sync", max: 5, windowSec: 60 } }, async ({ user }) => syncNodes(user.id));
