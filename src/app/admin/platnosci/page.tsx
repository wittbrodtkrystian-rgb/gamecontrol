import { db } from "@/lib/db";
import { PageTitle, Table, Badge, dt } from "@/components/ui";
import { formatPln } from "@/lib/money";
export const dynamic = "force-dynamic";
export default async function Payments() {
  const ps = await db.payment.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { order: { include: { user: { select: { email: true } } } } } });
  return (<><PageTitle>Płatności</PageTitle><Table head={["Data", "Zamówienie", "Klient", "Kwota", "Dostawca", "Status"]}>{ps.map((p) => <tr key={p.id}><td className="td">{dt(p.createdAt)}</td><td className="td">{p.order.number}</td><td className="td">{p.order.user.email}</td><td className="td">{formatPln(p.amount)}</td><td className="td">{p.provider}</td><td className="td"><Badge s={p.status} /></td></tr>)}</Table></>);
}
