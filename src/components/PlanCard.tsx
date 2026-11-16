import Link from "next/link";
import type { HostingPlan } from "@prisma/client";
import { formatMb, formatPln } from "@/lib/money";
export function PlanCard({ plan, featured }: { plan: HostingPlan; featured?: boolean }) {
  const specs = [["RAM", formatMb(plan.ramMb)], ["CPU", `${plan.cpuPercent}%`], ["Dysk NVMe", formatMb(plan.diskMb)], ["Sloty", String(plan.slots)]];
  return (
    <div className={`game-card rise flex flex-col ${featured ? "border-neon/70 shadow-glow" : ""}`}>
      {featured && <span className="absolute right-4 top-4 rounded-full bg-gradient-to-r from-neon to-violet px-3 py-0.5 text-[11px] font-bold text-white">Najczęściej wybierany</span>}
      <div className="text-sm font-semibold uppercase tracking-wide text-neon">{plan.name}</div>
      <div className="mt-2 text-4xl font-black">{formatPln(plan.priceMonthly)}<span className="text-sm font-normal text-slate-400">/mies.</span></div>
      <ul className="my-5 flex-1 space-y-2 text-sm text-slate-300">
        {specs.map(([k, v]) => <li key={k} className="flex items-center gap-2"><span className="text-emerald-400" aria-hidden>✓</span><span className="text-slate-400">{k}:</span> <b>{v}</b></li>)}
      </ul>
      {plan.available ? <Link className="btn-primary btn-xl" href={`/panel/zamow?plan=${plan.id}`}>Zamów</Link> : <span className="btn-ghost btn-xl cursor-not-allowed opacity-60">Niedostępny</span>}
    </div>
  );
}
