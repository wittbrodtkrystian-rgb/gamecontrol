"use client";
export async function api<T = unknown>(url: string, method = "POST", body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.error?.message ?? "Błąd żądania");
  return j as T;
}
