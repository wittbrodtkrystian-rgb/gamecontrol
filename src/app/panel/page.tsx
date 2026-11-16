import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { Badge, Empty, PageTitle, Stat, dt } from "@/components/ui";
import { ActionButton } from "@/components/Controls";
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = (await getCurrentUser())!;
  const [servers, notes, subs] = await Promise.all([
    db.server.findMany({ where: { userId: user.id }, include: { plan: { include: { game: true } } }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.subscription.findMany({ where: { userId: user.id, status: "ACTIVE" }, orderBy: { currentPeriodEnd: "asc" }, take: 1 }),
  ]);
  return (
    <>
      <PageTitle sub={`Witaj, ${user.name}`} action={<Link href="/panel/zamow" className="btn-primary">+ Nowy serwer</Link>}>Dashboard</PageTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Serwery" value={servers.length} /><Stat label="Działają" value={servers.filter((s) => s.status === "RUNNING").length} />
        <Stat label="Najbliższe odnowienie" value={subs[0] ? subs[0].currentPeriodEnd.toLocaleDateString("pl-PL") : "—"} />
      </div>
      <h2 className="mb-3 mt-8 font-semibold">Twoje serwery</h2>
      {servers.length === 0 ? <Empty>Nie masz jeszcze serwera. <Link className="text-neon" href="/panel/zamow">Zamów pierwszy</Link>.</Empty> :
        <div className="grid gap-4 md:grid-cols-2">{servers.map((s) => (
          <Link key={s.id} href={`/panel/serwery/${s.id}`} className="card transition hover:border-neon/60"><div className="flex items-center justify-between"><b>{s.name}</b><Badge s={s.status} /></div>
            <div className="mt-1 text-sm text-slate-400">{s.plan.game.name} · {s.plan.name}{s.isDemo && " · DEMO"}</div></Link>))}</div>}
      <div className="mb-3 mt-8 flex items-center justify-between"><h2 className="font-semibold">Powiadomienia</h2>{notes.some((n) => !n.readAt) && <ActionButton url="/api/notifications/read" label="Oznacz jako przeczytane" />}</div>
      {notes.length === 0 ? <Empty>Brak powiadomień.</Empty> : <div className="space-y-2">{notes.map((n) => (
        <div key={n.id} className={`card py-3 ${n.readAt ? "opacity-60" : ""}`}><div className="flex justify-between text-sm"><b>{n.title}</b><span className="text-xs text-slate-500">{dt(n.createdAt)}</span></div><p className="text-sm text-slate-400">{n.body}</p></div>))}</div>}
    </>
  );
}
