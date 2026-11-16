import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getServerFor } from "@/server/servers";
import { Badge, PageTitle, Table, dt } from "@/components/ui";
import { ActionButton, Console, Metrics, PowerControls } from "@/components/Controls";
import { formatMb } from "@/lib/money";
import { FileManager } from "@/components/FileManager";
import { EngineSettings } from "@/components/EngineSettings";
import { engineDefs } from "@/server/engines";
export const dynamic = "force-dynamic";

const tabs = [["przeglad", "Przegląd"], ["konsola", "Konsola"], ["pliki", "Pliki"], ["kopie", "Kopie zapasowe"], ["statystyki", "Statystyki"]] as const;
export default async function ServerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const user = (await getCurrentUser())!; const { id } = await params; const tab = (await searchParams).tab ?? "przeglad";
  const s = await getServerFor(user, id).catch(() => null);
  if (!s) notFound();
  const backups = tab === "kopie" ? await db.backup.findMany({ where: { serverId: id }, orderBy: { createdAt: "desc" } }) : [];
  const expired = s.subscription && s.subscription.status !== "ACTIVE";
  const engines = engineDefs(s.plan.game.features); const cfg = (s.orderItem?.config ?? {}) as { engine?: string; version?: string };
  return (
    <>
      <PageTitle sub={`${s.plan.game.name} · ${s.plan.name}${s.isDemo ? " · serwer DEMO" : ""}`} action={<Badge s={s.status} />}>{s.name}</PageTitle>
      <div className="-mx-1 mb-5 flex gap-1 overflow-x-auto border-b border-line">{tabs.map(([k, l]) => <Link key={k} href={`?tab=${k}`} className={`whitespace-nowrap px-3 py-2 text-sm ${tab === k ? "border-b-2 border-neon text-white" : "text-slate-400 hover:text-white"}`}>{l}</Link>)}</div>
      {expired && <div className="card mb-4 border-red-500/40 text-sm text-red-300">Usługa wygasła. {s.subscription && <ActionButton url={`/api/subscriptions/${s.subscription.id}/renew`} label="Przedłuż (DEMO)" className="btn-primary ml-2" />}</div>}
      {tab === "przeglad" && <div className="space-y-4">
        <div className="card"><PowerControls serverId={s.id} status={s.status} disabled={!!expired} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card text-sm space-y-1"><div className="label">Adres</div><div className="font-mono text-neon">{s.allocation ? `${s.allocation.ip}:${s.allocation.port}` : "—"}</div><div className="text-xs text-slate-500">{s.isDemo ? "Adres demonstracyjny — nie jest osiągalny." : s.node?.location}</div></div>
          <div className="card text-sm space-y-1"><div className="label">Zasoby</div><div>RAM {formatMb(s.ramMb)} · CPU {s.cpuPercent}% · Dysk {formatMb(s.diskMb)} · {s.slots} slotów</div></div>
          <div className="card text-sm space-y-1"><div className="label">Abonament</div><div>{s.subscription ? <>ważny do <b>{s.subscription.currentPeriodEnd.toLocaleDateString("pl-PL")}</b> <Badge s={s.subscription.status} /></> : "—"}</div>
            {s.subscription && <ActionButton url={`/api/subscriptions/${s.subscription.id}/renew`} label="Przedłuż o miesiąc (DEMO)" />}</div>
        </div>
        {engines.length > 0 && !s.isDemo && <EngineSettings serverId={s.id} engines={engines.map((e) => ({ key: e.key, label: e.label }))} current={{ engine: cfg.engine, version: cfg.version }}
          blockedReason={expired ? "Usługa wygasła — odnów abonament." : s.status === "INSTALLING" ? "Trwa instalacja serwera." : s.status !== "OFFLINE" ? "Zatrzymaj serwer, aby zmienić silnik lub wersję." : undefined} />}</div>}
      {tab === "konsola" && <Console serverId={s.id} running={s.status === "RUNNING"} demo={s.isDemo} />}
      {tab === "pliki" && (s.isDemo ? <div className="card text-sm text-slate-400">Menedżer plików działa tylko na prawdziwych serwerach (ten serwer jest w trybie DEMO).</div>
        : !["OFFLINE", "RUNNING", "STARTING", "STOPPING"].includes(s.status) ? <div className="card text-sm text-slate-400">Serwer jest jeszcze w trakcie instalacji. Pliki będą dostępne po jej zakończeniu.</div>
        : <FileManager serverId={s.id} canWrite={!expired} />)}
      {tab === "kopie" && <div className="space-y-4"><ActionButton url={`/api/servers/${s.id}/backups`} label="+ Utwórz kopię zapasową" className="btn-primary" />
        {backups.length === 0 ? <div className="card text-sm text-slate-400">Brak kopii zapasowych (limit: 3).</div> :
          <Table head={["Nazwa", "Rozmiar", "Status", "Data", ""]}>{backups.map((b) => <tr key={b.id}><td className="td">{b.name}</td><td className="td">{formatMb(b.sizeMb)}</td><td className="td"><Badge s={b.status} /></td><td className="td">{dt(b.createdAt)}</td>
            <td className="td text-right"><ActionButton url={`/api/servers/${s.id}/backups/${b.id}`} method="DELETE" label="Usuń" className="btn-danger" confirm="Usunąć kopię zapasową?" /></td></tr>)}</Table>}
        <p className="text-xs text-slate-500">Przywracanie kopii wymaga Wings (Etap 2).</p></div>}
      {tab === "statystyki" && <Metrics serverId={s.id} />}
    </>
  );
}
