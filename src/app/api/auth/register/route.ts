import { z } from "zod";
import { NextResponse } from "next/server";
import { route, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { hashPassword, createSession, cookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { audit } from "@/lib/audit";

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  name: z.string().trim().min(2).max(60),
  password: z.string().min(10, "Hasło musi mieć min. 10 znaków").max(128),
});
export const POST = route({ roles: "public", limit: { key: "register", max: 5, windowSec: 600 } }, async ({ req, ip }) => {
  const d = registerSchema.parse(await readJson(req));
  if (await db.user.findUnique({ where: { email: d.email } })) throw new ApiError(409, "EMAIL_TAKEN", "Konto z tym adresem już istnieje");
  const user = await db.user.create({ data: { email: d.email, name: d.name, passwordHash: await hashPassword(d.password) } });
  const { token, expiresAt } = await createSession(user.id, { ip, userAgent: req.headers.get("user-agent") });
  await audit(user.id, "user.registered", "User", user.id, {}, ip);
  const res = NextResponse.json({ id: user.id, role: user.role }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
  return res;
});
