import { route, readJson } from "@/lib/api";
import { provisionNode, provisionNodeSchema } from "@/server/node-provision";
// Zwraca skrypt z tokenem węzła — tylko ADMIN, z limitem żądań. Skrypt nie jest zapisywany ani logowany.
export const POST = route({ roles: ["ADMIN"], limit: { key: "node-provision", max: 5, windowSec: 300 } }, async ({ req, user, ip }) =>
  provisionNode(user.id, provisionNodeSchema.parse(await readJson(req)), ip));
