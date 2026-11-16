import Link from "next/link";
import type { HostingPlan } from "@prisma/client";
import { formatMb, formatPln } from "@/lib/money";
export function PlanCard({ plan, featured }: { plan: HostingPlan; featured?: boolean }) {
  return (
    <div className={`card rise flex flex-col ${featured ? "border-neon/60 shadow-glow" : ""}`}>
      <div className="text-sm font-semibold text-neon">{plan.name}</div>
      <div className="mt-2 text-3xl font-bold">{formatPln(plan.priceMonthly)}<span className="text-sm font-normal text-slate-400">/mies.</span></div>
      <ul className="my-4 flex-1 space-y-1.5 text-sm text-slate-300">
        <li>RAM: {formatMb(plan.ramMb)}</li><li>CPU: {plan.cpuPercent}%</li><li>Dysk NVMe: {formatMb(plan.diskMb)}</li><li>Sloty: {plan.slots}</li>
      </ul>
      {plan.available ? <Link className="btn-primary" href={`/panel/zamow?plan=${plan.id}`}>Zamów</Link> : <span className="btn-ghost cursor-not-allowed opacity-60">Niedostępny</span>}
    </div>
  );
}
