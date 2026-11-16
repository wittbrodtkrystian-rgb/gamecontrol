import { route, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { planUpdateSchema } from "@/server/admin";
export const PATCH = route<{ id: string }>({ roles: ["ADMIN"] }, async ({ req, user, params, ip }) => {
  const data = planUpdateSchema.parse(await readJson(req));
  const p = await db.hostingPlan.update({ where: { id: params.id }, data });
  await audit(user.id, "admin.plan.updated", "HostingPlan", p.id, data, ip);
  return p;
});
