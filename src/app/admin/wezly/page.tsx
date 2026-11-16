import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PageTitle, Table, Badge } from "@/components/ui";
import { Meter } from "@/components/Chart";
import { NodeToggles, NodeProvisionForm } from "@/components/AdminControls";
import { ActionButton } from "@/components/Controls";
import { env } from "@/lib/env";
export const dynamic = "force-dynamic";
export default async function Nodes() {
  const user = (await getCurrentUser())!;
  const nodes = await db.node.findMany({ orderBy: { name: "asc" } });
  const rows = await Promise.all(nodes.map(async (n) => ({ n, used: await db.server.aggregate({ where: { nodeId: n.id, status: { not: "ERROR" } }, _sum: { ramMb: true, diskMb: true, cpuPercent: true }, _count: true }), free: await db.allocation.count({ where: { nodeId: n.id, serverId: null, extraForServerId: null } }) })));
  return (<><PageTitle sub="Prawdziwe węzły Wings działają na osobnych maszynach Linux." action={user.role === "ADMIN" && !env.demoMode ? <ActionButton url="/api/admin/nodes/sync" label="Synchronizuj z Pterodactyl" className="btn-primary" /> : undefined}>Węzły i zasoby</PageTitle>
    {user.role === "ADMIN" && !env.demoMode && <NodeProvisionForm />}
    <div className="grid gap-4 lg:grid-cols-2">{rows.map(({ n, used, free }) => (
      <div key={n.id} className="card space-y-3"><div className="flex items-center justify-between"><div><b>{n.name}</b>{n.isDemo && <span className="ml-2 text-xs text-amber-300">DEMO</span>}<div className="text-xs text-slate-400">{n.location} · {n.fqdn}</div></div>
        <Badge s={!n.enabled ? "SUSPENDED" : n.maintenance ? "PENDING" : "ACTIVE"} /></div>
        <Meter label={`RAM ${used._sum.ramMb ?? 0}/${n.ramTotalMb} MB`} value={used._sum.ramMb ?? 0} max={n.ramTotalMb} /><Meter label={`Dysk ${used._sum.diskMb ?? 0}/${n.diskTotalMb} MB`} value={used._sum.diskMb ?? 0} max={n.diskTotalMb} />
        <Meter label={`CPU ${used._sum.cpuPercent ?? 0}/${n.cpuTotal}%`} value={used._sum.cpuPercent ?? 0} max={n.cpuTotal} /><div className="text-xs text-slate-400">Serwery: {used._count} · wolne alokacje: {free}</div>
        <NodeToggles id={n.id} enabled={n.enabled} maintenance={n.maintenance} canEdit={user.role === "ADMIN"} /></div>))}</div></>);
}
