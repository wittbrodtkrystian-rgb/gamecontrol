import { db } from "@/lib/db";
import { PageTitle, Table, Badge } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Servers() {
  const [servers, jobs] = await Promise.all([db.server.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { email: true } }, node: true, plan: { include: { game: true } } } }),
    db.provisioningJob.findMany({ where: { status: { in: ["FAILED", "WAITING_RESOURCES", "QUEUED"] } }, include: { orderItem: { include: { order: true } } }, take: 50 })]);
  return (<><PageTitle>Serwery</PageTitle><Table head={["Nazwa", "Klient", "Gra / pakiet", "Węzeł", "Status"]}>{servers.map((s) => <tr key={s.id}><td className="td">{s.name}{s.isDemo && " (DEMO)"}</td><td className="td">{s.user.email}</td><td className="td">{s.plan.game.name} {s.plan.name}</td><td className="td">{s.node?.name ?? "—"}</td><td className="td"><Badge s={s.status} /></td></tr>)}</Table>
    {jobs.length > 0 && <><h2 className="mb-3 mt-8 font-semibold">Zadania provisioningu wymagające uwagi</h2><Table head={["Zamówienie", "Status", "Próby", "Ostatni błąd"]}>{jobs.map((j) => <tr key={j.id}><td className="td">{j.orderItem.order.number}</td><td className="td"><Badge s={j.status} /></td><td className="td">{j.attempts}/{j.maxAttempts}</td><td className="td text-xs text-slate-400">{j.lastError ?? "—"}</td></tr>)}</Table></>}</>);
}
