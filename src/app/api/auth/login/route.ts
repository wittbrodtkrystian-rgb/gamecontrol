import { z } from "zod";
import { NextResponse } from "next/server";
import { route, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { verifyPassword, createSession, cookieOptions, SESSION_COOKIE } from "@/lib/auth";
import { ApiError } from "@/lib/errors";
import { audit } from "@/lib/audit";

const schema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });
const DUMMY = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8.dJb3vK1m1Vq2m3x8mS8mJmQxV6e2";
export const POST = route({ roles: "public", limit: { key: "login", max: 10, windowSec: 600 } }, async ({ req, ip }) => {
  const d = schema.parse(await readJson(req));
  const user = await db.user.findUnique({ where: { email: d.email } });
  const bad = new ApiError(401, "BAD_CREDENTIALS", "Nieprawidłowy e-mail lub hasło");
  if (user?.lockedUntil && user.lockedUntil > new Date()) throw new ApiError(423, "LOCKED", "Konto tymczasowo zablokowane. Spróbuj później.");
  const ok = await verifyPassword(d.password, user?.passwordHash ?? DUMMY); // stały czas także dla nieistniejącego konta
  if (!user || !ok || user.disabledAt) {
    if (user && !ok) {
      const fails = user.failedLogins + 1;
      await db.user.update({ where: { id: user.id }, data: { failedLogins: fails, lockedUntil: fails >= 5 ? new Date(Date.now() + 15 * 60_000) : null } });
    }
    throw bad;
  }
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  const { token, expiresAt } = await createSession(user.id, { ip, userAgent: req.headers.get("user-agent") });
  await audit(user.id, "user.login", "User", user.id, {}, ip);
  const res = NextResponse.json({ id: user.id, role: user.role });
  res.cookies.set(SESSION_COOKIE, token, cookieOptions(expiresAt));
  return res;
});
