import { route, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nodeCreateSchema } from "@/server/admin";
export const POST = route({ roles: ["ADMIN"] }, async ({ req, user, ip }) => {
  const n = await db.node.create({ data: nodeCreateSchema.parse(await readJson(req)) });
  await audit(user.id, "admin.node.created", "Node", n.id, { name: n.name }, ip);
  return n;
});
