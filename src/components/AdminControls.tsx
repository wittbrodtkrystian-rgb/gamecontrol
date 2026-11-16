"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { ActionButton } from "./Controls";

type Plan = { id: string; name: string; priceMonthly: number; ramMb: number; cpuPercent: number; diskMb: number; slots: number; available: boolean; pterodactylNestId: number | null; pterodactylEggId: number | null; dockerImage: string | null };
export function PlanEditor({ plan, game, canEdit }: { plan: Plan; game: string; canEdit: boolean }) {
  const r = useRouter(); const [p, setP] = useState({ ...plan, price: (plan.priceMonthly / 100).toFixed(2), nest: String(plan.pterodactylNestId ?? ""), egg: String(plan.pterodactylEggId ?? ""), image: plan.dockerImage ?? "" });
  const [msg, setMsg] = useState(""); const [busy, setBusy] = useState(false);
  const num = (k: keyof typeof p) => (e: React.ChangeEvent<HTMLInputElement>) => setP({ ...p, [k]: e.target.value });
  async function save() {
    setBusy(true); setMsg("");
    try {
      await api(`/api/admin/plans/${plan.id}`, "PATCH", { name: p.name, priceMonthly: Math.round(parseFloat(String(p.price).replace(",", ".")) * 100), ramMb: +p.ramMb, cpuPercent: +p.cpuPercent, diskMb: +p.diskMb, slots: +p.slots, available: p.available, pterodactylNestId: p.nest ? +p.nest : null, pterodactylEggId: p.egg ? +p.egg : null, dockerImage: p.image || null });
      setMsg("Zapisano"); r.refresh();
    } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  const f = (label: string, k: keyof typeof p, step = "1") => <div><label className="label">{label}</label><input className="input" type="number" step={step} disabled={!canEdit} value={String(p[k])} onChange={num(k)} /></div>;
  return (
    <div className="card space-y-3"><div className="flex items-center justify-between"><div><span className="text-xs text-slate-400">{game}</span><input className="input mt-1 font-semibold" disabled={!canEdit} value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} aria-label="Nazwa pakietu" /></div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit} checked={p.available} onChange={(e) => setP({ ...p, available: e.target.checked })} />Dostępny</label></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{f("Cena (zł)", "price", "0.01")}{f("RAM (MB)", "ramMb")}{f("CPU (%)", "cpuPercent")}{f("Dysk (MB)", "diskMb")}{f("Sloty", "slots")}</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">{f("Pterodactyl Nest ID", "nest")}{f("Pterodactyl Egg ID", "egg")}<div className="col-span-2"><label className="label">Obraz Docker (opcj.)</label><input className="input" disabled={!canEdit} value={p.image} onChange={(e) => setP({ ...p, image: e.target.value })} /></div></div>
      {canEdit && <div className="flex items-center gap-3"><button className="btn-primary" onClick={save} disabled={busy}>Zapisz</button><span className="text-sm text-slate-400">{msg}</span></div>}
      <p className="text-xs text-slate-500">Zmiany dotyczą nowych zamówień; istniejące serwery zachowują swoje limity.</p></div>
  );
}

export function NodeToggles({ id, enabled, maintenance, canEdit }: { id: string; enabled: boolean; maintenance: boolean; canEdit: boolean }) {
  if (!canEdit) return null;
  return <div className="flex gap-2"><ActionButton url={`/api/admin/nodes/${id}`} method="PATCH" body={{ enabled: !enabled }} label={enabled ? "Wyłącz" : "Włącz"} />
    <ActionButton url={`/api/admin/nodes/${id}`} method="PATCH" body={{ maintenance: !maintenance }} label={maintenance ? "Zakończ konserwację" : "Konserwacja"} /></div>;
}

/** Dodanie nowej maszyny: tworzy węzeł i alokacje w Pterodactylu, zwraca skrypt instalacji Wings (z tokenem — pokazywany raz). */
export function NodeProvisionForm() {
  const r = useRouter();
  const [f, setF] = useState({ name: "", fqdn: "", ip: "", scheme: "https", ramGb: "32", diskGb: "900", threads: "12", ports: "25565-25599, 27015-27099, 28015-28099, 30120-30199" });
  const [busy, setBusy] = useState(false), [err, setErr] = useState(""), [script, setScript] = useState(""), [copied, setCopied] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(""); setScript("");
    try {
      const res = await api<{ script: string }>("/api/admin/nodes/provision", "POST", { name: f.name, fqdn: f.fqdn, ip: f.ip, scheme: f.scheme, memoryMb: Math.round(+f.ramGb * 1024), diskMb: Math.round(+f.diskGb * 1024), cpuPercent: Math.round(+f.threads * 100), ports: f.ports });
      setScript(res.script); r.refresh();
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  const field = (id: keyof typeof f, label: string, ph = "", type = "text") => <div><label className="label" htmlFor={`np-${id}`}>{label}</label><input id={`np-${id}`} type={type} className="input" value={f[id]} onChange={set(id)} placeholder={ph} required /></div>;
  return (
    <details className="card mb-4">
      <summary className="cursor-pointer font-semibold">+ Dodaj nowy węzeł (maszynę z Wings)</summary>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        {field("name", "Nazwa węzła", "np. wings-pl-1")}{field("fqdn", "Domena lub adres węzła", "np. node1.twojadomena.pl")}
        {field("ip", "Publiczny adres IPv4 maszyny", "np. 203.0.113.10")}
        <div><label className="label" htmlFor="np-scheme">Połączenie panel ↔ Wings</label><select id="np-scheme" className="input" value={f.scheme} onChange={set("scheme")}><option value="https">HTTPS (wymaga domeny)</option><option value="http">HTTP (tylko test)</option></select></div>
        {field("ramGb", "RAM do sprzedaży (GB)", "", "number")}{field("diskGb", "Dysk do sprzedaży (GB)", "", "number")}
        {field("threads", "Wątki procesora", "", "number")}{field("ports", "Porty gier (zakresy)", "25565-25599, 27015-27099")}
        <div className="sm:col-span-2">
          <button className="btn-primary" disabled={busy}>{busy ? "Tworzenie…" : "Utwórz węzeł i wygeneruj skrypt"}</button>
          {err && <p role="alert" className="mt-2 text-sm text-red-300">{err}</p>}
        </div>
      </form>
      {script && (
        <div className="mt-4 space-y-2">
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-200">Skrypt zawiera token węzła i jest pokazany tylko raz. Uruchom go jako root na nowej maszynie (Debian/Ubuntu), potem usuń. Nie wklejaj go do czatu ani do repozytorium.</p>
          <textarea readOnly className="input h-56 font-mono text-xs" value={script} />
          <button type="button" className="btn-ghost" onClick={async () => { try { await navigator.clipboard.writeText(script); setCopied(true); } catch { setCopied(false); } }}>{copied ? "Skopiowano" : "Kopiuj skrypt"}</button>
        </div>)}
    </details>
  );
}

export function UserControls({ id, role, disabled }: { id: string; role: string; disabled: boolean }) {
  const r = useRouter(); const [err, setErr] = useState("");
  const run = async (body: object) => { setErr(""); try { await api(`/api/admin/users/${id}`, "PATCH", body); r.refresh(); } catch (e) { setErr((e as Error).message); } };
  return <div className="flex items-center gap-2"><select className="input w-auto py-1" value={role} onChange={(e) => run({ role: e.target.value })} aria-label="Rola"><option>CUSTOMER</option><option>SUPPORT</option><option>ADMIN</option></select>
    <button className={disabled ? "btn-ghost" : "btn-danger"} onClick={() => run({ disabled: !disabled })}>{disabled ? "Odblokuj" : "Zablokuj"}</button>{err && <span className="text-xs text-red-300">{err}</span>}</div>;
}
