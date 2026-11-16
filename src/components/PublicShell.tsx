import Link from "next/link";
import { Logo, DemoBanner } from "./ui";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";

export async function PublicShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const links = [["/oferta", t.nav.offer], ["/gry", t.nav.games], ["/faq", t.nav.faq]] as const;
  return (
    <>
      <DemoBanner />
      <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <nav className="flex items-center gap-4 text-sm">
            {links.map(([h, l]) => <Link key={h} href={h} className="text-slate-300 hover:text-white">{l}</Link>)}
            {user ? <Link className="btn-primary" href={user.role === "CUSTOMER" ? "/panel" : "/admin"}>{user.role === "CUSTOMER" ? t.nav.panel : t.nav.admin}</Link>
              : <><Link href="/logowanie" className="text-slate-300 hover:text-white">{t.nav.login}</Link><Link className="btn-primary" href="/rejestracja">{t.nav.register}</Link></>}
          </nav>
        </div>
      </header>
      <main>{children}</main>
      <footer className="mt-20 border-t border-line py-8 text-center text-xs text-slate-500">© {new Date().getFullYear()} GameControl Cloud · Ceny w wersji testowej, nie stanowią oferty handlowej.</footer>
    </>
  );
}
