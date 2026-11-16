import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Badge, Empty, PageTitle } from "@/components/ui";
import { formatMb } from "@/lib/money";
export const dynamic = "force-dynamic";
export default async function Servers() {
  const user = (await getCurrentUser())!;
  const servers = await db.server.findMany({ where: { userId: user.id }, include: { plan: { include: { game: true } }, allocation: true }, orderBy: { createdAt: "desc" } });
  return (<><PageTitle action={<Link href="/panel/zamow" className="btn-primary">+ Nowy serwer</Link>}>Moje serwery</PageTitle>
    {servers.length === 0 ? <Empty>Brak serwerów.</Empty> : <div className="grid gap-4 lg:grid-cols-2">{servers.map((s) => (
      <Link key={s.id} href={`/panel/serwery/${s.id}`} className="card transition hover:border-neon/60"><div className="flex items-center justify-between"><b className="text-lg">{s.name}</b><Badge s={s.status} /></div>
        <div className="mt-1 text-sm text-slate-400">{s.plan.game.name} · {s.plan.name}</div>
        <div className="mt-3 text-xs text-slate-500">RAM {formatMb(s.ramMb)} · CPU {s.cpuPercent}% · Dysk {formatMb(s.diskMb)} · {s.slots} slotów</div>
        {s.allocation && <div className="mt-1 font-mono text-xs text-neon">{s.allocation.ip}:{s.allocation.port}{s.isDemo && " (DEMO)"}</div>}</Link>))}</div>}</>);
}
