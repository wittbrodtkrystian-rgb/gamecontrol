"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";

/** Zmiana silnika i wersji gry (reinstalacja serwera). Dostępna, gdy serwer jest zatrzymany. */
export function EngineSettings({ serverId, engines, current, blockedReason }: { serverId: string; engines: { key: string; label: string }[]; current: { engine?: string; version?: string }; blockedReason?: string }) {
  const r = useRouter();
  const [engine, setEngine] = useState(engines.some((e) => e.key === current.engine) ? current.engine! : engines[0]?.key ?? "");
  const [version, setVersion] = useState(current.version ?? "latest"), [busy, setBusy] = useState(false), [err, setErr] = useState(""), [ok, setOk] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setOk("");
    if (!window.confirm("Serwer zostanie zainstalowany ponownie z wybranym silnikiem i wersją. Świat i pliki zostają, ale zmiana silnika lub przejście na starszą wersję może uszkodzić świat. Zrób wcześniej kopię plików. Kontynuować?")) return;
    setBusy(true);
    try { await api(`/api/servers/${serverId}/engine`, "POST", { engine, version: version.trim() || "latest" }); setOk("Reinstalacja rozpoczęta. Serwer będzie dostępny po jej zakończeniu."); r.refresh(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="card space-y-3 text-sm">
      <div className="label">Silnik i wersja</div>
      <div className="text-slate-400">Aktualnie: <b className="text-slate-200">{engines.find((e) => e.key === current.engine)?.label ?? current.engine ?? "—"}</b>, wersja <b className="text-slate-200">{current.version ?? "—"}</b></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className="label" htmlFor="eng-engine">Silnik</label><select id="eng-engine" className="input" value={engine} onChange={(e) => setEngine(e.target.value)} disabled={!!blockedReason || busy}>{engines.map((e) => <option key={e.key} value={e.key}>{e.label}</option>)}</select></div>
        <div><label className="label" htmlFor="eng-version">Wersja gry</label><input id="eng-version" className="input" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="latest lub np. 1.21.4" maxLength={12} disabled={!!blockedReason || busy} /></div>
      </div>
      {blockedReason && <p className="text-amber-300">{blockedReason}</p>}
      {err && <p role="alert" className="text-red-300">{err}</p>}{ok && <p className="text-emerald-300">{ok}</p>}
      <button className="btn-ghost" disabled={!!blockedReason || busy}>{busy ? "Rozpoczynanie…" : "Zmień i zainstaluj ponownie"}</button>
    </form>
  );
}
