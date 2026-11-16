import { z } from "zod";
import { audit } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { getAdapter } from "./provisioning";
import { ProvisioningError } from "./provisioning/adapter";
import { getServerFor } from "./servers";

/** Menedżer plików serwera klienta (Client API Pterodactyla). Dostęp tylko właściciela (IDOR → 404); ścieżki są walidowane. */
type Actor = { id: string; role: string };
export const MAX_EDIT_BYTES = 1_000_000;
const ACCESSIBLE = ["OFFLINE", "RUNNING", "STARTING", "STOPPING"];
const CTRL = /[\x00-\x1f\x7f\\]/;

/** Normalizuje ścieżkę katalogu/pliku: zawsze od "/", bez "..", bez znaków sterujących i backslashy. */
export function safePath(raw: unknown): string {
  if (typeof raw !== "string" || raw.length > 512 || CTRL.test(raw)) throw new ApiError(400, "BAD_PATH", "Niepoprawna ścieżka");
  const segs: string[] = [];
  for (const s of raw.split("/")) {
    if (s === "" || s === ".") continue;
    if (s === ".." || s.length > 255) throw new ApiError(400, "BAD_PATH", "Niepoprawna ścieżka");
    segs.push(s);
  }
  return "/" + segs.join("/");
}
/** Pojedyncza nazwa pliku/katalogu (bez separatorów). */
export function safeName(raw: unknown): string {
  if (typeof raw !== "string" || !raw || raw.length > 255 || raw === "." || raw === ".." || raw.includes("/") || CTRL.test(raw)) throw new ApiError(400, "BAD_NAME", "Niepoprawna nazwa");
  return raw;
}
const joinPath = (dir: string, name: string) => (dir === "/" ? "" : dir) + "/" + name;

export const writeFileSchema = z.object({ path: z.string(), content: z.string().max(MAX_EDIT_BYTES) });
export const mkdirSchema = z.object({ dir: z.string(), name: z.string() });
export const deleteSchema = z.object({ dir: z.string(), names: z.array(z.string()).min(1).max(50) });
export const renameSchema = z.object({ dir: z.string(), from: z.string(), to: z.string() });

async function ctx(actor: Actor, id: string, write: boolean) {
  const s = await getServerFor(actor, id);
  const files = getAdapter().files;
  if (!files || s.isDemo) throw new ApiError(501, "NOT_AVAILABLE", "Menedżer plików jest dostępny tylko dla prawdziwych serwerów");
  if (!ACCESSIBLE.includes(s.status)) throw new ApiError(409, "BAD_STATE", "Serwer nie jest gotowy (trwa instalacja lub wystąpił błąd)");
  if (write && s.subscription && s.subscription.status !== "ACTIVE") throw new ApiError(402, "SUBSCRIPTION_INACTIVE", "Usługa wygasła — odnów abonament");
  return { s, files };
}
const upstream = async <T>(p: Promise<T>): Promise<T> => {
  try { return await p; } catch (e) {
    if (e instanceof ProvisioningError) throw new ApiError(e.retryable ? 503 : 502, "FILES_UNAVAILABLE", "Nie udało się wykonać operacji na plikach");
    throw e;
  }
};

export async function listFiles(actor: Actor, id: string, dir: string) {
  const { s, files } = await ctx(actor, id, false); const d = safePath(dir);
  const entries = await upstream(files.list(s, d));
  entries.sort((a, b) => Number(a.isFile) - Number(b.isFile) || a.name.localeCompare(b.name));
  return { dir: d, entries };
}

export async function readFileText(actor: Actor, id: string, path: string) {
  const { s, files } = await ctx(actor, id, false); const p = safePath(path);
  const name = p.split("/").pop()!; const dir = p.slice(0, p.length - name.length) || "/";
  const entry = (await upstream(files.list(s, dir === "/" ? "/" : dir.replace(/\/$/, "")))).find((e) => e.name === name);
  if (!entry || !entry.isFile) throw new ApiError(404, "NOT_FOUND", "Nie znaleziono pliku");
  if (entry.size > MAX_EDIT_BYTES) throw new ApiError(413, "TOO_LARGE", "Plik jest za duży do edycji w przeglądarce (maks. 1 MB)");
  const content = await upstream(files.read(s, p));
  if (content.includes("\u0000")) throw new ApiError(415, "BINARY", "To plik binarny — nie można go edytować jako tekst");
  return { path: p, content, size: entry.size };
}

export async function writeFileText(actor: Actor, id: string, input: z.infer<typeof writeFileSchema>) {
  const { s, files } = await ctx(actor, id, true); const p = safePath(input.path);
  if (p === "/") throw new ApiError(400, "BAD_PATH", "Niepoprawna ścieżka");
  await upstream(files.write(s, p, input.content));
  await audit(actor.id, "server.file.write", "Server", id, { path: p, bytes: input.content.length }); // bez treści pliku
  return { ok: true };
}

export async function makeFolder(actor: Actor, id: string, input: z.infer<typeof mkdirSchema>) {
  const { s, files } = await ctx(actor, id, true); const dir = safePath(input.dir), name = safeName(input.name);
  await upstream(files.mkdir(s, dir, name));
  await audit(actor.id, "server.file.mkdir", "Server", id, { path: joinPath(dir, name) });
  return { ok: true };
}

export async function deleteFiles(actor: Actor, id: string, input: z.infer<typeof deleteSchema>) {
  const { s, files } = await ctx(actor, id, true); const dir = safePath(input.dir); const names = input.names.map(safeName);
  await upstream(files.remove(s, dir, names));
  await audit(actor.id, "server.file.delete", "Server", id, { dir, count: names.length });
  return { ok: true };
}

export async function renameFile(actor: Actor, id: string, input: z.infer<typeof renameSchema>) {
  const { s, files } = await ctx(actor, id, true); const dir = safePath(input.dir), from = safeName(input.from), to = safeName(input.to);
  await upstream(files.rename(s, dir, from, to));
  await audit(actor.id, "server.file.rename", "Server", id, { dir, from, to });
  return { ok: true };
}
