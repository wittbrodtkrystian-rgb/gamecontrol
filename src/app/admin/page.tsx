import { db } from "@/lib/db";
import { PageTitle, Stat, Table, Badge, dt } from "@/components/ui";
import { formatPln } from "@/lib/money";
export const dynamic = "force-dynamic";
export default async function AdminHome() {
  const month = new Date(Date.now() - 30 * 86400_000);
  const [customers, servers, running, pending, failedJobs, revenue, waiting, recent] = await Promise.all([
    db.user.count({ where: { role: "CUSTOMER" } }), db.server.count(), db.server.count({ where: { status: "RUNNING" } }),
    db.order.count({ where: { status: "PENDING_PAYMENT" } }), db.provisioningJob.count({ where: { status: "FAILED" } }),
    db.payment.aggregate({ where: { status: "SUCCEEDED", createdAt: { gte: month } }, _sum: { amount: true } }),
    db.provisioningJob.count({ where: { status: "WAITING_RESOURCES" } }),
    db.order.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { user: { select: { email: true } } } }),
  ]);
  return (<><PageTitle sub="Podsumowanie ostatnich 30 dni">Dashboard biznesowy</PageTitle>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Stat label="Przychód (30 dni)" value={formatPln(revenue._sum.amount ?? 0)} /><Stat label="Klienci" value={customers} /><Stat label="Serwery" value={servers} hint={`${running} działa`} /><Stat label="Nieopłacone zamówienia" value={pending} /></div>
    {(failedJobs > 0 || waiting > 0) && <div className="card mt-4 border-amber-500/40 text-sm text-amber-300">Uwaga: {failedJobs} nieudanych zadań provisioningu, {waiting} czeka na wolne zasoby.</div>}
    <h2 className="mb-3 mt-8 font-semibold">Ostatnie zamówienia</h2>
    <Table head={["Numer", "Klient", "Kwota", "Status", "Data"]}>{recent.map((o) => <tr key={o.id}><td className="td">{o.number}</td><td className="td">{o.user.email}</td><td className="td">{formatPln(o.totalAmount)}</td><td className="td"><Badge s={o.status} /></td><td className="td">{dt(o.createdAt)}</td></tr>)}</Table></>);
}
