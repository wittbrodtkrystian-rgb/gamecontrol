import Link from "next/link";
import { PublicShell } from "@/components/PublicShell";
import { db } from "@/lib/db";
import { formatPln } from "@/lib/money";
export const dynamic = "force-dynamic";

const ACCENTS = [
  { from: "from-emerald-400/25", text: "text-emerald-300", icon: "⛏️" },
  { from: "from-sky-400/25", text: "text-sky-300", icon: "🎯" },
  { from: "from-orange-400/25", text: "text-orange-300", icon: "🔥" },
];
const STEPS = [
  ["1", "Wybierz grę", "Minecraft, CS2 albo Rust. Pakiet dobierzesz do liczby graczy."],
  ["2", "Zamów", "Podajesz nazwę serwera i płacisz. Bez formularzy na pół strony."],
  ["3", "Graj", "Serwer tworzy się sam. Włączasz go jednym kliknięciem w panelu."],
];
const PERKS = [
  ["⚡", "Start w minutę", "Po potwierdzeniu płatności serwer powstaje automatycznie."],
  ["🎛️", "Jeden prosty panel", "Start, stop, restart, konsola, kopie zapasowe i statystyki."],
  ["🛡️", "Bezpiecznie", "Izolacja kont, audyt działań i weryfikacja płatności."],
];

export default async function Home() {
  const games = await db.game.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" }, include: { plans: { where: { available: true }, orderBy: { priceMonthly: "asc" }, take: 1 } } });
  return (
    <PublicShell>
      <section className="relative isolate overflow-hidden">
        <div className="grid-bg absolute inset-0 -z-10" aria-hidden />
        <div className="orb -left-24 top-10 -z-10 h-72 w-72 bg-neon" aria-hidden />
        <div className="orb -right-24 top-32 -z-10 h-80 w-80 bg-violet" style={{ animationDelay: "-6s" }} aria-hidden />
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-24 text-center">
          <p className="rise mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-panel/80 px-4 py-1.5 text-xs text-neon backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" /> Serwery gier gotowe w minutę
          </p>
          <h1 className="rise mx-auto max-w-4xl text-5xl font-black leading-[1.05] tracking-tight sm:text-7xl">
            Twój serwer gier.<br /><span className="shine-text">Włączony w minutę.</span>
          </h1>
          <p className="rise mx-auto mt-6 max-w-xl text-lg text-slate-300">Minecraft, Counter-Strike 2 i Rust. Zamów, zapłać i zarządzaj wszystkim z jednego, prostego panelu.</p>
          <div className="rise mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/oferta" className="btn-primary btn-xl">Wybierz serwer →</Link>
            <Link href="/rejestracja" className="btn-ghost btn-xl">Załóż konto</Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-5 px-4 sm:grid-cols-3">
        {games.map((g, i) => {
          const a = ACCENTS[i % ACCENTS.length];
          return (
            <Link key={g.id} href="/oferta" className="game-card group">
              <div className={`absolute inset-0 -z-0 bg-gradient-to-br ${a.from} to-transparent opacity-60 transition group-hover:opacity-100`} aria-hidden />
              <div className="relative">
                <div className="float mb-4 text-4xl" aria-hidden>{a.icon}</div>
                <h2 className="text-xl font-extrabold">{g.name}</h2>
                <p className="mt-2 min-h-[3rem] text-sm text-slate-300">{g.description}</p>
                {g.plans[0] && <p className="mt-5 text-sm text-slate-300">od <b className={`text-2xl ${a.text}`}>{formatPln(g.plans[0].priceMonthly)}</b>/mies.</p>}
                <span className="mt-4 inline-block text-sm font-semibold text-neon transition group-hover:translate-x-1">Zobacz pakiety →</span>
              </div>
            </Link>
          );
        })}
      </section>

      <section className="mx-auto mt-24 max-w-6xl px-4">
        <h2 className="text-center text-3xl font-extrabold sm:text-4xl">Trzy kroki do <span className="shine-text">gry</span></h2>
        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {STEPS.map(([n, h, p]) => (
            <div key={n} className="card text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-neon to-violet text-lg font-black text-white shadow-glow">{n}</div>
              <h3 className="text-lg font-bold">{h}</h3><p className="mt-2 text-sm text-slate-400">{p}</p>
            </div>))}
        </div>
      </section>

      <section className="mx-auto mt-20 grid max-w-6xl gap-5 px-4 sm:grid-cols-3">
        {PERKS.map(([i, h, p]) => (
          <div key={h} className="card transition hover:border-neon/60"><div className="text-2xl" aria-hidden>{i}</div><h3 className="mt-3 font-bold">{h}</h3><p className="mt-1 text-sm text-slate-400">{p}</p></div>))}
      </section>

      <section className="mx-auto my-24 max-w-4xl px-4">
        <div className="relative overflow-hidden rounded-3xl border border-neon/30 bg-gradient-to-br from-neon/15 via-card to-violet/20 p-10 text-center shadow-glow">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Gotowy na swój serwer?</h2>
          <p className="mx-auto mt-3 max-w-md text-slate-300">Załóż konto w kilka sekund i wybierz pakiet. Resztą zajmiemy się my.</p>
          <Link href="/rejestracja" className="btn-primary btn-xl mt-7">Zaczynamy →</Link>
        </div>
      </section>
    </PublicShell>
  );
}
