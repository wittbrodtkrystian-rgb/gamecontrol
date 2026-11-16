import { db } from "@/lib/db";
import { PageTitle, Table, Badge, dt } from "@/components/ui";
import { formatPln } from "@/lib/money";
export const dynamic = "force-dynamic";
export default async function Orders() {
  const orders = await db.order.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { email: true } }, items: true } });
  return (<><PageTitle>Zamówienia</PageTitle><Table head={["Numer", "Klient", "Pozycje", "Kwota", "Status", "Data"]}>{orders.map((o) => <tr key={o.id}><td className="td">{o.number}</td><td className="td">{o.user.email}</td><td className="td">{o.items.map((i) => i.planName).join(", ")}</td><td className="td">{formatPln(o.totalAmount)}</td><td className="td"><Badge s={o.status} /></td><td className="td">{dt(o.createdAt)}</td></tr>)}</Table></>);
}
