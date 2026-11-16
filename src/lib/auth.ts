import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { forbidden, unauthorized } from "./errors";

export const SESSION_COOKIE = "gc_session";
const SESSION_DAYS = 14;
const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export const hashPassword = (pw: string) => bcrypt.hash(pw, 12);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

export async function createSession(userId: string, meta: { ip?: string | null; userAgent?: string | null } = {}) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt, ip: meta.ip, userAgent: meta.userAgent?.slice(0, 255) } });
  return { token, expiresAt };
}
export const cookieOptions = (expires: Date) => ({
  httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/", expires,
});

export async function destroySession(token: string) {
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
}

export async function userFromToken(token: string | undefined | null) {
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!s) return null;
  if (s.expiresAt < new Date()) { await db.session.delete({ where: { id: s.id } }).catch(() => {}); return null; }
  if (s.user.disabledAt) return null;
  return s.user;
}
export type AuthUser = NonNullable<Awaited<ReturnType<typeof userFromToken>>>;

export async function getCurrentUser(): Promise<AuthUser | null> {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}

export function assertRole(user: AuthUser | null, roles: Role[]): AuthUser {
  if (!user) throw unauthorized();
  if (!roles.includes(user.role)) throw forbidden();
  return user;
}
export const STAFF: Role[] = ["ADMIN", "SUPPORT"];
