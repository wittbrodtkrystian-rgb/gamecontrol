"use client";
import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setErr(""); setBusy(true);
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      const r = await api<{ role: string }>(`/api/auth/${mode}`, "POST", f);
      const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      window.location.href = safe ?? (r.role === "CUSTOMER" ? "/panel" : "/admin");
    } catch (x) { setErr((x as Error).message); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="card mx-auto mt-16 max-w-md space-y-4 border-neon/30 p-7 shadow-glow">
      <h1 className="text-3xl font-black">{mode === "login" ? "Zaloguj się" : "Załóż konto"}</h1>
      {mode === "register" && <div><label className="label" htmlFor="name">Imię / nick</label><input id="name" name="name" className="input" required minLength={2} autoComplete="name" /></div>}
      <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" className="input" required autoComplete="email" /></div>
      <div><label className="label" htmlFor="password">Hasło</label><input id="password" name="password" type="password" className="input" required minLength={mode === "register" ? 10 : 1} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        {mode === "register" && <p className="mt-1 text-xs text-slate-500">Minimum 10 znaków.</p>}</div>
      {err && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{err}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? "Proszę czekać…" : mode === "login" ? "Zaloguj" : "Utwórz konto"}</button>
      <p className="text-center text-sm text-slate-400">{mode === "login" ? <>Nie masz konta? <Link className="text-neon" href="/rejestracja">Zarejestruj się</Link></> : <>Masz już konto? <Link className="text-neon" href="/logowanie">Zaloguj się</Link></>}</p>
    </form>
  );
}
