"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { AreaChart, Meter } from "./Chart";

export function LogoutButton() {
  return <button className="btn-ghost w-full" onClick={async () => { await api("/api/auth/logout"); window.location.href = "/"; }}>Wyloguj</button>;
}

/** Przycisk akcji z obsługą błędów; po sukcesie odświeża dane strony. */
export function ActionButton({ url, method = "POST", body, label, className = "btn-ghost", confirm: ask, onDone }: { url: string; method?: string; body?: unknown; label: string; className?: string; confirm?: string; onDone?: (r: unknown) => void }) {
  const r = useRouter(); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  return (
    <span className="inline-flex flex-col">
      <button className={className} disabled={busy} onClick={async () => {
        if (ask && !window.confirm(ask)) return;
        setBusy(true); setErr("");
        try { const res = await api(url, method, body); onDone?.(res); r.refresh(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
      }}>{busy ? "…" : label}</button>
      {err && <span role="alert" className="mt-1 text-xs text-red-300">{err}</span>}
    </span>
  );
}

export function PowerControls({ serverId, status, disabled }: { serverId: string; status: string; disabled?: boolean }) {
  const off = disabled || !["OFFLINE", "RUNNING"].includes(status);
  const b = (action: string, label: string, cls = "btn-ghost") => <ActionButton key={action} url={`/api/servers/${serverId}/power`} body={{ action }} label={label} className={`${cls} ${off ? "pointer-events-none opacity-50" : ""}`} />;
  return <div className="flex flex-wrap gap-2">{b("start", "▶ Start", "btn-primary")}{b("restart", "↻ Restart")}{b("stop", "■ Stop")}{b("kill", "Wymuś zatrzymanie", "btn-danger")}</div>;
}

export function Console({ serverId, running, demo }: { serverId: string; running: boolean; demo: boolean }) {
  const [lines, setLines] = useState<string[]>([demo ? "[DEMO] Konsola symulowana — komendy nie są wykonywane na prawdziwym serwerze." : "Konsola produkcyjna wymaga integracji Pterodactyl."]);
  const [cmd, setCmd] = useState(""); const box = useRef<HTMLDivElement>(null);
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); }, [lines]);
  async function send(e: React.FormEvent) {
    e.preventDefault(); const c = cmd.trim(); if (!c) return; setCmd("");
    try { const r = await api<{ lines: string[] }>(`/api/servers/${serverId}/command`, "POST", { command: c }); setLines((l) => [...l, ...r.lines]); }
    catch (x) { setLines((l) => [...l, `! ${(x as Error).message}`]); }
  }
  return (
    <div className="card p-0">
      <div ref={box} className="h-72 overflow-y-auto rounded-t-2xl bg-black/50 p-4 font-mono text-xs leading-relaxed text-emerald-300" aria-live="polite">{lines.map((l, i) => <div key={i}>{l}</div>)}</div>
      <form onSubmit={send} className="flex gap-2 border-t border-line p-3"><input className="input font-mono" value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder={running ? "Wpisz polecenie gry…" : "Uruchom serwer, aby używać konsoli"} maxLength={200} disabled={!running} aria-label="Polecenie konsoli" /><button className="btn-primary" disabled={!running}>Wyślij</button></form>
    </div>
  );
}

type Point = { cpu: number; ramMb: number; diskMb: number; netInKb: number; netOutKb: number; players: number };
export function Metrics({ serverId }: { serverId: string }) {
  const [d, setD] = useState<{ demo: boolean; limits: { ramMb: number; diskMb: number; cpuPercent: number }; points: Point[] } | null>(null);
  const load = useCallback(async () => { try { setD(await api(`/api/servers/${serverId}/metrics`, "GET")); } catch {} }, [serverId]);
  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);
  if (!d) return <div className="card text-sm text-slate-400">Ładowanie statystyk…</div>;
  const p = d.points, last = p.at(-1);
  if (!last) return <div className="card text-sm text-slate-400">Brak danych — uruchom serwer, aby zbierać statystyki.</div>;
  return (
    <div className="space-y-4">
      {d.demo && <p className="text-xs text-amber-300">Dane DEMO generowane syntetycznie.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card"><div className="mb-1 text-sm font-semibold">CPU — {last.cpu}%</div><AreaChart data={p.map((x) => x.cpu)} max={d.limits.cpuPercent} unit="%" /></div>
        <div className="card"><div className="mb-1 text-sm font-semibold">RAM — {last.ramMb} MB</div><AreaChart data={p.map((x) => x.ramMb)} max={d.limits.ramMb} color="#8b5cf6" unit=" MB" /></div>
        <div className="card"><div className="mb-1 text-sm font-semibold">Sieć (kB/s) ↓{last.netInKb} ↑{last.netOutKb}</div><AreaChart data={p.map((x) => x.netInKb + x.netOutKb)} color="#22d3ee" /></div>
        <div className="card space-y-3"><Meter label="Dysk" value={last.diskMb} max={d.limits.diskMb} /><Meter label="RAM" value={last.ramMb} max={d.limits.ramMb} /><div className="text-sm">Gracze online: <b>{last.players}</b></div></div>
      </div>
    </div>
  );
}

export function OrderForm({ plans, initial }: { plans: { id: string; label: string; price: string }[]; initial?: string }) {
  const [planId, setPlanId] = useState(initial && plans.some((p) => p.id === initial) ? initial : plans[0]?.id ?? "");
  const [name, setName] = useState(""), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const [gslt, setGslt] = useState(""), [eula, setEula] = useState(false), [lic, setLic] = useState("");
  const planLabel = plans.find((p) => p.id === planId)?.label ?? "";
  const isMc = /Minecraft/i.test(planLabel), isCs = /Counter-Strike/i.test(planLabel), isFivem = /FiveM/i.test(planLabel);
  const envVars = { ...(isCs && gslt.trim() ? { STEAM_GSLT: gslt.trim() } : {}), ...(isFivem && lic.trim() ? { FIVEM_LICENSE: lic.trim() } : {}) };
  const [key] = useState(() => crypto.randomUUID());
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try { const o = await api<{ id: string }>("/api/orders", "POST", { items: [{ planId, serverName: name, ...(isMc ? { acceptEula: eula } : {}), ...(Object.keys(envVars).length ? { envVars } : {}) }], idempotencyKey: key }); window.location.href = `/panel/zamowienia/${o.id}`; }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="card max-w-xl space-y-4">
      <div><label className="label" htmlFor="plan">Pakiet</label><select id="plan" className="input" value={planId} onChange={(e) => setPlanId(e.target.value)}>{plans.map((p) => <option key={p.id} value={p.id}>{p.label} — {p.price}/mies.</option>)}</select></div>
      <div><label className="label" htmlFor="sname">Nazwa serwera</label><input id="sname" className="input" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={40} placeholder="np. Moje Survival" /></div>
      {isMc && <label className="flex items-start gap-2 text-sm text-slate-300"><input type="checkbox" className="mt-1" checked={eula} onChange={(e) => setEula(e.target.checked)} required /><span>Akceptuję <a className="text-neon underline" href="https://aka.ms/MinecraftEULA" target="_blank" rel="noopener noreferrer">umowę EULA Minecrafta</a>. Jest wymagana, żeby serwer mógł wystartować.</span></label>}
      {isFivem && <div><label className="label" htmlFor="lic">Klucz licencyjny FiveM (Cfx.re)</label><input id="lic" className="input" value={lic} onChange={(e) => setLic(e.target.value)} maxLength={33} required autoComplete="off" placeholder="Klucz z portal.cfx.re" /><p className="mt-1 text-xs text-slate-500">Każdy serwer wymaga własnego klucza. Wygenerujesz go bezpłatnie na portal.cfx.re.</p></div>}
      {isCs && <div><label className="label" htmlFor="gslt">Token Steam GSLT (Counter-Strike 2)</label><input id="gslt" className="input" value={gslt} onChange={(e) => setGslt(e.target.value)} maxLength={32} autoComplete="off" placeholder="32 znaki z steamcommunity.com/dev/managegameservers" /></div>}
      {err && <p role="alert" className="text-sm text-red-300">{err}</p>}
      <button className="btn-primary w-full" disabled={busy || !planId}>Przejdź do płatności</button>
    </form>
  );
}

export function SettingsForm({ name }: { name: string }) {
  const [msg, setMsg] = useState(""), [err, setErr] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setMsg(""); setErr("");
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const body: Record<string, string> = { name: f.name }; if (f.newPassword) { body.newPassword = f.newPassword; body.currentPassword = f.currentPassword; }
    try { await api("/api/account", "PATCH", body); if (f.newPassword) { window.location.href = "/logowanie"; return; } setMsg("Zapisano."); } catch (x) { setErr((x as Error).message); }
  }
  return (
    <form onSubmit={submit} className="card max-w-xl space-y-4">
      <div><label className="label" htmlFor="n">Imię / nick</label><input id="n" name="name" className="input" defaultValue={name} required minLength={2} /></div>
      <div className="grid gap-4 sm:grid-cols-2"><div><label className="label" htmlFor="cp">Obecne hasło</label><input id="cp" name="currentPassword" type="password" className="input" autoComplete="current-password" /></div>
        <div><label className="label" htmlFor="np">Nowe hasło (min. 10)</label><input id="np" name="newPassword" type="password" className="input" minLength={10} autoComplete="new-password" /></div></div>
      <p className="text-xs text-slate-500">Zmiana hasła wylogowuje ze wszystkich urządzeń.</p>
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}{err && <p role="alert" className="text-sm text-red-300">{err}</p>}
      <button className="btn-primary">Zapisz</button>
    </form>
  );
}

export function CheckoutButton({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  return <span className="inline-flex flex-col"><button className="btn-primary" disabled={busy} onClick={async () => {
    setBusy(true); setErr("");
    try { const r = await api<{ url: string }>(`/api/orders/${orderId}/checkout`); window.location.href = r.url; } catch (e) { setErr((e as Error).message); setBusy(false); }
  }}>{busy ? "…" : "Zapłać kartą (Stripe)"}</button>{err && <span role="alert" className="mt-1 text-xs text-red-300">{err}</span>}</span>;
}
