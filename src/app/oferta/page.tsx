import type { Metadata } from "next";
import { PublicShell } from "@/components/PublicShell";
import { PlanCard } from "@/components/PlanCard";
import type { HostingPlan } from "@prisma/client";
import { db } from "@/lib/db";
import { formatMb, formatPln } from "@/lib/money";
export const metadata: Metadata = { title: "Oferta" };
export const dynamic = "force-dynamic";

export default async function Offer() {
  const games = await db.game.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" }, include: { plans: { orderBy: { priceMonthly: "asc" } } } });
  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-4 pt-14">
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Wybierz swój <span className="shine-text">serwer</span></h1>
        <p className="mt-3 text-slate-300">Bez ukrytych opłat. Ceny w wersji testowej, wszystkie kwoty brutto w PLN.</p>
        {games.map((g) => (
          <section key={g.id} className="mt-10">
            <h2 className="mb-4 border-l-4 border-neon pl-3 text-2xl font-extrabold">{g.name}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{g.plans.map((p, i) => <PlanCard key={p.id} plan={p} featured={g.plans.length > 2 && i === 1} />)}</div>
            <div className="card mt-4 overflow-x-auto p-0">
              <table className="w-full min-w-[520px] text-sm"><thead className="border-b border-line"><tr><th className="th">Porównanie</th>{g.plans.map((p) => <th key={p.id} className="th">{p.name}</th>)}</tr></thead>
                <tbody className="divide-y divide-line">{(([["Cena", (p: HostingPlan) => formatPln(p.priceMonthly)], ["RAM", (p: HostingPlan) => formatMb(p.ramMb)], ["CPU", (p: HostingPlan) => `${p.cpuPercent}%`], ["Dysk", (p: HostingPlan) => formatMb(p.diskMb)], ["Sloty", (p: HostingPlan) => String(p.slots)]] as [string, (p: HostingPlan) => string][])).map(([l, f]) =>
                  <tr key={l}><td className="td text-slate-400">{l}</td>{g.plans.map((p) => <td key={p.id} className="td">{f(p)}</td>)}</tr>)}</tbody></table>
            </div>
          </section>
        ))}
      </div>
    </PublicShell>
  );
}
