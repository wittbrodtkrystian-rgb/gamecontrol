import { db } from "@/lib/db";
import { PageTitle, Table, Badge, dt } from "@/components/ui";
export const dynamic = "force-dynamic";
export default async function Customers() {
  const users = await db.user.findMany({ where: { role: "CUSTOMER" }, orderBy: { createdAt: "desc" }, take: 200, include: { _count: { select: { servers: true, orders: true } } } });
  return (<><PageTitle>Klienci</PageTitle><Table head={["E-mail", "Nazwa", "Serwery", "Zamówienia", "Od", "Stan"]}>{users.map((u) => <tr key={u.id}><td className="td">{u.email}</td><td className="td">{u.name}</td><td className="td">{u._count.servers}</td><td className="td">{u._count.orders}</td><td className="td">{dt(u.createdAt)}</td><td className="td">{u.disabledAt ? <Badge s="SUSPENDED" /> : <Badge s="ACTIVE" />}</td></tr>)}</Table></>);
}
