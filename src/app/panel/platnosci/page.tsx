import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Badge, Empty, PageTitle, Table, dt } from "@/components/ui";
import { formatPln } from "@/lib/money";
export const dynamic = "force-dynamic";
export default async function Payments() {
  const user = (await getCurrentUser())!;
  const orders = await db.order.findMany({ where: { userId: user.id }, include: { payments: true }, orderBy: { createdAt: "desc" }, take: 50 });
  return (<><PageTitle sub="Faktury zostaną dodane razem z integracją z systemem fakturowania.">Płatności i zamówienia</PageTitle>
    {orders.length === 0 ? <Empty>Brak zamówień.</Empty> : <Table head={["Numer", "Data", "Kwota", "Status", "Płatność"]}>{orders.map((o) => <tr key={o.id}><td className="td"><Link className="text-neon" href={`/panel/zamowienia/${o.id}`}>{o.number}</Link></td><td className="td">{dt(o.createdAt)}</td><td className="td">{formatPln(o.totalAmount)}</td><td className="td"><Badge s={o.status} /></td><td className="td">{o.payments[0] ? <>{o.payments[0].provider} <Badge s={o.payments[0].status} /></> : "—"}</td></tr>)}</Table>}</>);
}
