import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { destroySession, SESSION_COOKIE } from "@/lib/auth";
export const POST = route({}, async ({ req }) => {
  const t = req.cookies.get(SESSION_COOKIE)?.value;
  if (t) await destroySession(t);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
});
