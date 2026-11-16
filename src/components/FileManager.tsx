"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";

type Entry = { name: string; isFile: boolean; size: number; modifiedAt: string };
const fmt = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);
const join = (dir: string, n: string) => (dir === "/" ? "" : dir) + "/" + n;

/** Menedżer plików serwera: przeglądanie, edycja plików tekstowych (do 1 MB), nowy folder, zmiana nazwy, usuwanie. */
export function FileManager({ serverId, canWrite }: { serverId: string; canWrite: boolean }) {
  const base = `/api/servers/${serverId}/files`;
  const [dir, setDir] = useState("/"), [entries, setEntries] = useState<Entry[]>([]), [busy, setBusy] = useState(true), [err, setErr] = useState(""), [msg, setMsg] = useState("");
  const [open, setOpen] = useState<{ path: string; content: string; orig: string } | null>(null), [saving, setSaving] = useState(false);

  const load = useCallback(async (d: string) => {
    setBusy(true); setErr("");
    try { const r = await api<{ dir: string; entries: Entry[] }>(`${base}?dir=${encodeURIComponent(d)}`, "GET"); setEntries(r.entries); setDir(r.dir); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }, [base]);
  useEffect(() => { load("/"); }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => { setErr(""); setMsg(""); try { await fn(); setMsg(ok); await load(dir); } catch (e) { setErr((e as Error).message); } };
  const openFile = async (e: Entry) => {
    setErr(""); setMsg("");
    try { const r = await api<{ path: string; content: string }>(`${base}/content?path=${encodeURIComponent(join(dir, e.name))}`, "GET"); setOpen({ path: r.path, content: r.content, orig: r.content }); }
    catch (x) { setErr((x as Error).message); }
  };
  const save = async () => {
    if (!open) return; setSaving(true); setErr(""); setMsg("");
    try { await api(`${base}/content`, "PUT", { path: open.path, content: open.content }); setOpen({ ...open, orig: open.content }); setMsg("Zapisano. Zmiany wejdą w życie po restarcie serwera."); }
    catch (x) { setErr((x as Error).message); } finally { setSaving(false); }
  };
  const crumbs = dir.split("/").filter(Boolean);
  const dirty = !!open && open.content !== open.orig;

  if (open) return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-mono text-sm text-neon">{open.path}{dirty && <span className="ml-2 text-amber-300">• niezapisane</span>}</div>
        <div className="flex gap-2">{canWrite && <button className="btn-primary" disabled={!dirty || saving} onClick={save}>{saving ? "Zapisywanie…" : "Zapisz"}</button>}
          <button className="btn-ghost" onClick={() => { if (!dirty || window.confirm("Odrzucić niezapisane zmiany?")) { setOpen(null); setMsg(""); } }}>Zamknij</button></div></div>
      <textarea className="input h-[60vh] font-mono text-xs" spellCheck={false} value={open.content} readOnly={!canWrite} onChange={(e) => setOpen({ ...open, content: e.target.value })} aria-label={`Zawartość pliku ${open.path}`} />
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}{err && <p role="alert" className="text-sm text-red-300">{err}</p>}
    </div>);

  return (
    <div className="card space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Ścieżka">
          <button className="text-neon hover:underline" onClick={() => load("/")}>/</button>
          {crumbs.map((c, i) => <span key={i} className="flex items-center gap-1"><span className="text-slate-500">/</span><button className="text-neon hover:underline" onClick={() => load("/" + crumbs.slice(0, i + 1).join("/"))}>{c}</button></span>)}
        </nav>
        <div className="flex gap-2"><button className="btn-ghost" onClick={() => load(dir)}>Odśwież</button>
          {canWrite && <button className="btn-ghost" onClick={() => { const n = window.prompt("Nazwa nowego folderu"); if (n) run(() => api(base, "POST", { dir, name: n }), "Folder utworzony."); }}>+ Nowy folder</button>}</div>
      </div>
      {msg && <p className="text-sm text-emerald-300">{msg}</p>}{err && <p role="alert" className="text-sm text-red-300">{err}</p>}
      {busy ? <p className="text-sm text-slate-400">Ładowanie…</p> : (
        <ul className="divide-y divide-line text-sm">
          {dir !== "/" && <li className="py-2"><button className="text-neon hover:underline" onClick={() => load(dir.split("/").slice(0, -1).join("/") || "/")}>.. (wyżej)</button></li>}
          {entries.length === 0 && <li className="py-3 text-slate-400">Pusty katalog.</li>}
          {entries.map((e) => (
            <li key={e.name} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
              <div className="min-w-0 flex-1">
                <button className="max-w-full break-all text-left hover:text-neon" onClick={() => (e.isFile ? openFile(e) : load(join(dir, e.name)))}>{e.isFile ? "📄" : "📁"} {e.name}</button>
                <div className="text-xs text-slate-500">{e.isFile ? `${fmt(e.size)} · ` : ""}{new Date(e.modifiedAt).toLocaleString("pl-PL")}</div>
              </div>
              {canWrite && <div className="flex shrink-0 gap-1">
                <button className="btn-ghost px-2 py-1 text-xs" onClick={() => { const n = window.prompt("Nowa nazwa", e.name); if (n && n !== e.name) run(() => api(base, "PATCH", { dir, from: e.name, to: n }), "Zmieniono nazwę."); }}>Zmień nazwę</button>
                <button className="btn-danger px-2 py-1 text-xs" onClick={() => { if (window.confirm(`Usunąć „${e.name}”? Tej operacji nie można cofnąć.`)) run(() => api(base, "DELETE", { dir, names: [e.name] }), "Usunięto."); }}>Usuń</button></div>}
            </li>))}
        </ul>)}
      <p className="text-xs text-slate-500">Edycja dotyczy plików tekstowych do 1 MB (np. server.properties, pliki .cfg, .yml). Większe pliki i wgrywanie wymagają SFTP.</p>
    </div>
  );
}
