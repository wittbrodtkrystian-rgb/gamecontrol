import Link from "next/link";
import type { ReactNode } from "react";
import { env } from "@/lib/env";

export const Logo = () => (
  <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
    <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-neon to-violet text-sm shadow-glow">GC</span>
    <span>GameControl <span className="text-neon">Cloud</span></span>
  </Link>
);
export const DemoBanner = () => env.demoMode ? (
  <div className="bg-amber-500/15 px-4 py-1.5 text-center text-xs font-semibold text-amber-300">TRYB DEMO — serwery i płatności są symulowane. Nie pobieramy pieniędzy.</div>
) : null;

const tone: Record<string, string> = {
  RUNNING: "bg-emerald-500/15 text-emerald-300", COMPLETED: "bg-emerald-500/15 text-emerald-300", SUCCEEDED: "bg-emerald-500/15 text-emerald-300", ACTIVE: "bg-emerald-500/15 text-emerald-300", READY: "bg-emerald-500/15 text-emerald-300",
  OFFLINE: "bg-slate-500/20 text-slate-300", PENDING_PAYMENT: "bg-amber-500/15 text-amber-300", PENDING: "bg-amber-500/15 text-amber-300",
  INSTALLING: "bg-sky-500/15 text-sky-300", STARTING: "bg-sky-500/15 text-sky-300", STOPPING: "bg-sky-500/15 text-sky-300", PROVISIONING: "bg-sky-500/15 text-sky-300", PAID: "bg-sky-500/15 text-sky-300", CREATING: "bg-sky-500/15 text-sky-300",
  ERROR: "bg-red-500/15 text-red-300", FAILED: "bg-red-500/15 text-red-300", SUSPENDED: "bg-red-500/15 text-red-300", EXPIRED: "bg-red-500/15 text-red-300", CANCELLED: "bg-slate-500/20 text-slate-400",
};
const pl: Record<string, string> = {
  RUNNING: "Działa", OFFLINE: "Wyłączony", INSTALLING: "Instalacja", STARTING: "Uruchamianie", STOPPING: "Zatrzymywanie", SUSPENDED: "Zawieszony", ERROR: "Błąd", PENDING: "Oczekuje",
  PENDING_PAYMENT: "Oczekuje na płatność", PAID: "Opłacone", PROVISIONING: "Tworzenie serwera", COMPLETED: "Zrealizowane", FAILED: "Błąd", CANCELLED: "Anulowane", REFUNDED: "Zwrócone",
  SUCCEEDED: "Udana", ACTIVE: "Aktywna", EXPIRED: "Wygasła", PAST_DUE: "Zaległa", READY: "Gotowa", CREATING: "Tworzenie",
};
export const Badge = ({ s }: { s: string }) => <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone[s] ?? "bg-slate-500/20 text-slate-300"}`}>{pl[s] ?? s}</span>;
export const PageTitle = ({ children, sub, action }: { children: ReactNode; sub?: string; action?: ReactNode }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">{children}</h1>{sub && <p className="mt-1 text-sm text-slate-400">{sub}</p>}</div>{action}</div>
);
export const Stat = ({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) => (
  <div className="card rise"><div className="text-xs uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 text-3xl font-bold">{value}</div>{hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}</div>
);
export const Table = ({ head, children }: { head: string[]; children: ReactNode }) => (
  <div className="card overflow-x-auto p-0"><table className="w-full min-w-[640px]"><thead className="border-b border-line"><tr>{head.map((h) => <th key={h} className="th">{h}</th>)}</tr></thead><tbody className="divide-y divide-line">{children}</tbody></table></div>
);
export const Empty = ({ children }: { children: ReactNode }) => <div className="card text-center text-sm text-slate-400">{children}</div>;
export const dt = (d: Date) => d.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "short" });
