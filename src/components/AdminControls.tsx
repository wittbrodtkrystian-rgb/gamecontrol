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

export function UserControls({ id, role, disabled }: { id: string; role: string; disabled: boolean }) {
  const r = useRouter(); const [err, setErr] = useState("");
  const run = async (body: object) => { setErr(""); try { await api(`/api/admin/users/${id}`, "PATCH", body); r.refresh(); } catch (e) { setErr((e as Error).message); } };
  return <div className="flex items-center gap-2"><select className="input w-auto py-1" value={role} onChange={(e) => run({ role: e.target.value })} aria-label="Rola"><option>CUSTOMER</option><option>SUPPORT</option><option>ADMIN</option></select>
    <button className={disabled ? "btn-ghost" : "btn-danger"} onClick={() => run({ disabled: !disabled })}>{disabled ? "Odblokuj" : "Zablokuj"}</button>{err && <span className="text-xs text-red-300">{err}</span>}</div>;
}
