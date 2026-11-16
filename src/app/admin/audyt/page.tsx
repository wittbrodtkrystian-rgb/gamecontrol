import { db } from "@/lib/db";
import { PageTitle, Table, dt } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Audit() {
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { actor: { select: { email: true } } } });
  return (<><PageTitle sub="Ostatnie 200 zdarzeń">Logi audytowe</PageTitle><Table head={["Czas", "Użytkownik", "Akcja", "Obiekt", "IP"]}>{logs.map((l) => <tr key={l.id}><td className="td whitespace-nowrap">{dt(l.createdAt)}</td><td className="td">{l.actor?.email ?? "system"}</td><td className="td font-mono text-xs">{l.action}</td><td className="td text-xs text-slate-400">{l.entityType} {l.entityId?.slice(0, 8)}</td><td className="td text-xs">{l.ip ?? "—"}</td></tr>)}</Table></>);
}
