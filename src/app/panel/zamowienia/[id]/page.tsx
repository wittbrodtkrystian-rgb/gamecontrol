import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getOrderFor } from "@/server/orders";
import { env } from "@/lib/env";
import { Badge, PageTitle, Table } from "@/components/ui";
import { ActionButton, CheckoutButton } from "@/components/Controls";
import { formatPln } from "@/lib/money";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await getCurrentUser())!;
  const order = await getOrderFor(user, (await params).id).catch(() => null);
  if (!order) notFound();
  const server = order.status === "COMPLETED" ? await db.server.findFirst({ where: { orderItem: { orderId: order.id } }, include: { allocation: true } }) : null;
  return (<><PageTitle sub={`Utworzono ${order.createdAt.toLocaleString("pl-PL")}`} action={<Badge s={order.status} />}>Zamówienie {order.number}</PageTitle>
    <Table head={["Pozycja", "Nazwa serwera", "Cena"]}>{order.items.map((i) => <tr key={i.id}><td className="td">{i.planName}</td><td className="td">{i.serverName}</td><td className="td">{formatPln(i.unitPrice)}/mies.</td></tr>)}</Table>
    {server?.allocation && <div className="card mt-4 text-sm"><div className="label">Adres serwera (wpisz w grze)</div><div className="font-mono text-lg text-neon select-all">{server.allocation.ip}:{server.allocation.port}</div>
      <div className="text-xs text-slate-500">{server.isDemo ? "Adres demonstracyjny — nie jest osiągalny." : "Serwer uruchomisz w panelu. Przy pierwszym starcie świat generuje się chwilę."}</div></div>}
    <div className="card mt-4 flex flex-wrap items-center justify-between gap-3"><div className="text-lg">Razem: <b>{formatPln(order.totalAmount)}</b></div>
      {order.status === "PENDING_PAYMENT" && (env.demoMode
        ? <div className="flex flex-col items-end gap-2"><ActionButton url={`/api/orders/${order.id}/pay-demo`} label="Symuluj płatność (DEMO)" className="btn-primary" /><span className="text-xs text-amber-300">Nie zostanie pobrana żadna kwota.</span><ActionButton url={`/api/orders/${order.id}/cancel`} label="Anuluj zamówienie" className="btn-ghost" /></div>
        : <CheckoutButton orderId={order.id} />)}
      {server && <Link className="btn-primary" href={`/panel/serwery/${server.id}`}>Przejdź do serwera</Link>}
      {["PAID", "PROVISIONING"].includes(order.status) && <span className="text-sm text-sky-300">Tworzymy serwer — odśwież stronę za chwilę.</span>}
      {order.status === "FAILED" && <span className="text-sm text-red-300">Wystąpił problem. Zespół został powiadomiony.</span>}</div></>);
}
