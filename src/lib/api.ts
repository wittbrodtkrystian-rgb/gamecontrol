import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import type { Role } from "@prisma/client";
import { ApiError } from "./errors";
import { assertRole, userFromToken, SESSION_COOKIE, type AuthUser } from "./auth";
import { rateLimit } from "./rate-limit";

export const clientIp = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";

type Ctx<P> = { req: NextRequest; user: AuthUser; params: P; ip: string };
type Opts = { roles?: Role[] | "public"; limit?: { key: string; max: number; windowSec: number } };

/** Opakowanie handlera: sesja + role (backend), rate limit, ochrona CSRF (Origin), walidacja i bezpieczne błędy. */
export function route<P = Record<string, string>>(opts: Opts, handler: (c: Ctx<P>) => Promise<unknown>) {
  return async (req: NextRequest, rc: { params: Promise<P> }) => {
    try {
      const ip = clientIp(req);
      if (opts.limit && !rateLimit(`${opts.limit.key}:${ip}`, opts.limit.max, opts.limit.windowSec))
        throw new ApiError(429, "RATE_LIMITED", "Zbyt wiele żądań, spróbuj później");
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const origin = req.headers.get("origin");
        if (origin && new URL(origin).host !== req.headers.get("host"))
          throw new ApiError(403, "BAD_ORIGIN", "Niedozwolone źródło żądania");
      }
      let user = null as AuthUser | null;
      if (opts.roles !== "public") user = assertRole(await userFromToken(req.cookies.get(SESSION_COOKIE)?.value), opts.roles ?? ["ADMIN", "SUPPORT", "CUSTOMER"]);
      const out = await handler({ req, user: user as AuthUser, params: await rc.params, ip });
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });
      if (e instanceof ZodError)
        return NextResponse.json({ error: { code: "VALIDATION", message: "Nieprawidłowe dane", issues: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } }, { status: 400 });
      console.error("[api]", e);
      return NextResponse.json({ error: { code: "INTERNAL", message: "Błąd wewnętrzny serwera" } }, { status: 500 });
    }
  };
}
export async function readJson(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { throw new ApiError(400, "BAD_JSON", "Nieprawidłowy JSON"); }
}
