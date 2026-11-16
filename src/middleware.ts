import { NextResponse, type NextRequest } from "next/server";
/** Wstępna bramka (tylko obecność ciasteczka). Prawdziwa autoryzacja jest w layoutach i API (backend). */
export function middleware(req: NextRequest) {
  if (!req.cookies.get("gc_session")) {
    const url = req.nextUrl.clone(); url.pathname = "/logowanie"; url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
}
export const config = { matcher: ["/panel/:path*", "/admin/:path*"] };
