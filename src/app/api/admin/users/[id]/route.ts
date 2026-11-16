import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
const schema = z.object({ role: z.enum(["ADMIN", "SUPPORT", "CUSTOMER"]).optional(), disabled: z.boolean().optional() });
export const PATCH = route<{ id: string }>({ roles: ["ADMIN"] }, async ({ req, user, params, ip }) => {
  const d = schema.parse(await readJson(req));
  if (params.id === user.id) throw new ApiError(400, "SELF", "Nie możesz zmienić własnego konta");
  const u = await db.user.update({ where: { id: params.id }, data: { role: d.role, disabledAt: d.disabled === undefined ? undefined : d.disabled ? new Date() : null } });
  if (d.disabled || d.role) await db.session.deleteMany({ where: { userId: u.id } });
  await audit(user.id, "admin.user.updated", "User", u.id, d, ip);
  return { id: u.id, role: u.role, disabled: !!u.disabledAt };
});
