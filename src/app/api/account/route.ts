import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
const schema = z.object({ name: z.string().trim().min(2).max(60).optional(), locale: z.enum(["pl", "en"]).optional(),
  currentPassword: z.string().max(128).optional(), newPassword: z.string().min(10).max(128).optional() });
export const PATCH = route({ limit: { key: "account", max: 20, windowSec: 600 } }, async ({ req, user }) => {
  const d = schema.parse(await readJson(req));
  const data: { name?: string; locale?: string; passwordHash?: string } = { name: d.name, locale: d.locale };
  if (d.newPassword) {
    if (!d.currentPassword || !(await verifyPassword(d.currentPassword, user.passwordHash))) throw new ApiError(400, "BAD_PASSWORD", "Obecne hasło jest nieprawidłowe");
    data.passwordHash = await hashPassword(d.newPassword);
  }
  await db.user.update({ where: { id: user.id }, data });
  if (data.passwordHash) await db.session.deleteMany({ where: { userId: user.id } }); // unieważnij sesje po zmianie hasła
  return { ok: true };
});
