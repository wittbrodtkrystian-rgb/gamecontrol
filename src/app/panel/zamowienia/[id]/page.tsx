import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getOrderFor } from "@/server/orders";
import { env } from "@/lib/env";
import { Badge, PageTitle, Table } from "@/components/ui";
import { ActionButton } from "@/components/Controls";
import { formatPln } from "@/lib/money";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await getCurrentUser())!;
  const order = await getOrderFor(user, (await params).id).catch(() => null);
  if (!order) notFound();
  const server = order.status === "COMPLETED" ? await db.server.findFirst({ where: { orderItem: { orderId: order.id } } }) : null;
  return (<><PageTitle sub={`Utworzono ${order.createdAt.toLocaleString("pl-PL")}`} action={<Badge s={order.status} />}>Zamówienie {order.number}</PageTitle>
    <Table head={["Pozycja", "Nazwa serwera", "Cena"]}>{order.items.map((i) => <tr key={i.id}><td className="td">{i.planName}</td><td className="td">{i.serverName}</td><td className="td">{formatPln(i.unitPrice)}/mies.</td></tr>)}</Table>
    <div className="card mt-4 flex flex-wrap items-center justify-between gap-3"><div className="text-lg">Razem: <b>{formatPln(order.totalAmount)}</b></div>
      {order.status === "PENDING_PAYMENT" && (env.demoMode
        ? <div className="flex flex-col items-end gap-2"><ActionButton url={`/api/orders/${order.id}/pay-demo`} label="Symuluj płatność (DEMO)" className="btn-primary" /><span className="text-xs text-amber-300">Nie zostanie pobrana żadna kwota.</span><ActionButton url={`/api/orders/${order.id}/cancel`} label="Anuluj zamówienie" className="btn-ghost" /></div>
        : <span className="text-sm text-slate-400">Płatności online będą dostępne po konfiguracji Stripe (Etap 3).</span>)}
      {server && <Link className="btn-primary" href={`/panel/serwery/${server.id}`}>Przejdź do serwera</Link>}
      {["PAID", "PROVISIONING"].includes(order.status) && <span className="text-sm text-sky-300">Tworzymy serwer — odśwież stronę za chwilę.</span>}
      {order.status === "FAILED" && <span className="text-sm text-red-300">Wystąpił problem. Zespół został powiadomiony.</span>}</div></>);
}
