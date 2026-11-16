import Link from "next/link";
import { PublicShell } from "@/components/PublicShell";
import { db } from "@/lib/db";
import { formatPln } from "@/lib/money";
export const dynamic = "force-dynamic";

export default async function Home() {
  const games = await db.game.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" }, include: { plans: { where: { available: true }, orderBy: { priceMonthly: "asc" }, take: 1 } } });
  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-4 pt-20 pb-16 text-center">
        <p className="rise mb-4 inline-block rounded-full border border-line bg-panel px-4 py-1 text-xs text-neon">Hosting serwerów gier nowej generacji</p>
        <h1 className="rise mx-auto max-w-3xl text-4xl font-extrabold leading-tight sm:text-6xl">Twój serwer gier. <span className="bg-gradient-to-r from-neon to-violet bg-clip-text text-transparent">Gotowy w minutę.</span></h1>
        <p className="rise mx-auto mt-5 max-w-2xl text-slate-400">Minecraft, Counter-Strike 2 i Rust. Zamów, opłać i zarządzaj z jednego panelu — konsola, kopie zapasowe i statystyki w czasie rzeczywistym.</p>
        <div className="rise mt-8 flex justify-center gap-3"><Link href="/oferta" className="btn-primary">Zobacz ofertę</Link><Link href="/rejestracja" className="btn-ghost">Załóż konto</Link></div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-4 px-4 sm:grid-cols-3">
        {games.map((g) => (
          <Link key={g.id} href="/oferta" className="card rise transition hover:border-neon/60">
            <h2 className="text-lg font-bold">{g.name}</h2><p className="mt-2 text-sm text-slate-400">{g.description}</p>
            {g.plans[0] && <p className="mt-4 text-sm">od <b className="text-neon">{formatPln(g.plans[0].priceMonthly)}</b>/mies.</p>}
          </Link>
        ))}
      </section>
      <section className="mx-auto mt-16 grid max-w-6xl gap-4 px-4 sm:grid-cols-3">
        {[["Automatyczny start", "Po potwierdzeniu płatności serwer tworzy się sam."], ["Pełna kontrola", "Start, stop, restart, konsola i kopie zapasowe."], ["Bezpieczeństwo", "Izolacja kont, audyt działań i weryfikacja płatności."]].map(([h, p]) => (
          <div key={h} className="card"><h3 className="font-semibold">{h}</h3><p className="mt-2 text-sm text-slate-400">{p}</p></div>))}
      </section>
    </PublicShell>
  );
}
