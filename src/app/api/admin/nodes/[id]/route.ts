import { route, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nodeUpdateSchema } from "@/server/admin";
export const PATCH = route<{ id: string }>({ roles: ["ADMIN"] }, async ({ req, user, params, ip }) => {
  const data = nodeUpdateSchema.parse(await readJson(req));
  const n = await db.node.update({ where: { id: params.id }, data });
  await audit(user.id, "admin.node.updated", "Node", n.id, data, ip);
  return n;
});
