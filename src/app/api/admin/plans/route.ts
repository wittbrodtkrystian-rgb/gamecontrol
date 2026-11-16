import { route, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { planCreateSchema } from "@/server/admin";
export const POST = route({ roles: ["ADMIN"] }, async ({ req, user, ip }) => {
  const p = await db.hostingPlan.create({ data: planCreateSchema.parse(await readJson(req)) });
  await audit(user.id, "admin.plan.created", "HostingPlan", p.id, { slug: p.slug }, ip);
  return p;
});
