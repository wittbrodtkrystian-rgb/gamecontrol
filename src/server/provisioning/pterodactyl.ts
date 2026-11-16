import { createHash, randomBytes } from "crypto";
import { env } from "@/lib/env";
import { ProvisioningError, type CreateServerInput, type FileOps, type GameServerAdapter, type PowerAction } from "./adapter";
import type { ServerStatus } from "@prisma/client";

/**
 * Integracja z Pterodactyl: Application API (tworzenie/zawieszanie/usuwanie) i Client API (zasilanie, stan).
 * Klucze są czytane wyłącznie z env po stronie serwera. Logika sprawdzona na MOCKU API (tests/pterodactyl.test.ts),
 * NIE na prawdziwym panelu — pierwsze uruchomienie na żywym panelu może wymagać drobnych poprawek.
 */
async function call(kind: "application" | "client", key: string, method: string, path: string, body?: unknown) {
  if (!env.pteroUrl || !key) throw new ProvisioningError(`Pterodactyl (${kind}) nie jest skonfigurowany`, false);
  let res: Response;
  try {
    res = await fetch(`${env.pteroUrl.replace(/\/$/, "")}/api/${kind}${path}`, {
      method, signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json", "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) { throw new ProvisioningError(`Pterodactyl niedostępny: ${(e as Error).message}`, true); }
  if (res.status === 204) return null;
  const text = await res.text();
  if (!res.ok) throw new ProvisioningError(`Pterodactyl HTTP ${res.status}: ${text.slice(0, 300)}`, res.status >= 500 || res.status === 429);
  return JSON.parse(text);
}
export const app = (m: string, p: string, b?: unknown) => call("application", env.pteroKey, m, p, b);
const client = (m: string, p: string, b?: unknown) => call("client", env.pteroClientKey, m, p, b);

/** Zapis pliku w katalogu serwera przez Client API (treść jako zwykły tekst). */
async function writeFile(uuid: string, path: string, content: string) {
  if (!env.pteroUrl || !env.pteroClientKey) throw new ProvisioningError("Pterodactyl (client) nie jest skonfigurowany", false);
  let res: Response;
  try {
    res = await fetch(`${env.pteroUrl.replace(/\/$/, "")}/api/client/servers/${uuid.slice(0, 8)}/files/write?file=${encodeURIComponent(path)}`, {
      method: "POST", signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${env.pteroClientKey}`, Accept: "application/json", "Content-Type": "text/plain" }, body: content,
    });
  } catch (e) { throw new ProvisioningError(`Pterodactyl niedostępny: ${(e as Error).message}`, true); }
  if (!res.ok) throw new ProvisioningError(`Pterodactyl HTTP ${res.status} przy zapisie ${path}`, res.status >= 500 || res.status === 429);
}

/** Odczyt pliku jako tekst (Client API zwraca surową treść). */
async function readFile(uuid: string, path: string): Promise<string> {
  if (!env.pteroUrl || !env.pteroClientKey) throw new ProvisioningError("Pterodactyl (client) nie jest skonfigurowany", false);
  let res: Response;
  try {
    res = await fetch(`${env.pteroUrl.replace(/\/$/, "")}/api/client/servers/${uuid.slice(0, 8)}/files/contents?file=${encodeURIComponent(path)}`, { signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${env.pteroClientKey}`, Accept: "text/plain" } });
  } catch (e) { throw new ProvisioningError(`Pterodactyl niedostępny: ${(e as Error).message}`, true); }
  if (!res.ok) throw new ProvisioningError(`Pterodactyl HTTP ${res.status} przy odczycie ${path}`, res.status >= 500 || res.status === 429);
  return res.text();
}
const sid = (s: { externalUuid: string | null }) => { if (!s.externalUuid) throw new ProvisioningError("Serwer nie ma uuid Pterodactyl", false); return s.externalUuid.slice(0, 8); };
const pteroFiles: FileOps = {
  async list(s, dir) {
    const r = await client("GET", `/servers/${sid(s)}/files/list?directory=${encodeURIComponent(dir)}`);
    return ((r?.data ?? []) as { attributes: { name: string; is_file: boolean; size: number; modified_at: string; mimetype: string } }[]).map((x) => ({ name: x.attributes.name, isFile: x.attributes.is_file, size: x.attributes.size, modifiedAt: x.attributes.modified_at, mime: x.attributes.mimetype }));
  },
  read: (s, path) => readFile(sid(s), path),
  write: (s, path, content) => writeFile(sid(s), path, content),
  async mkdir(s, dir, name) { await client("POST", `/servers/${sid(s)}/files/create-folder`, { root: dir, name }); },
  async remove(s, dir, names) { await client("POST", `/servers/${sid(s)}/files/delete`, { root: dir, files: names }); },
  async rename(s, dir, from, to) { await client("PUT", `/servers/${sid(s)}/files/rename`, { root: dir, files: [{ from, to }] }); },
};

const STATE: Record<string, ServerStatus> = { running: "RUNNING", starting: "STARTING", stopping: "STOPPING", offline: "OFFLINE" };

export class PterodactylAdapter implements GameServerAdapter {
  readonly name = "Pterodactyl";
  readonly isDemo = false;
  readonly files = pteroFiles;

  private async ensureUser(email: string, name: string): Promise<number> {
    const found = await app("GET", `/users?filter[email]=${encodeURIComponent(email)}`);
    const existing = found?.data?.find((u: { attributes: { email: string } }) => u.attributes.email.toLowerCase() === email.toLowerCase());
    if (existing) return existing.attributes.id;
    const [first, ...rest] = name.trim().split(/\s+/);
    const username = (email.split("@")[0].replace(/[^a-z0-9]/gi, "").toLowerCase().slice(0, 12) || "user") + createHash("sha1").update(email).digest("hex").slice(0, 6);
    const r = await app("POST", "/users", { email, username, first_name: first || "Klient", last_name: rest.join(" ") || "GameControl" });
    return r.attributes.id;
  }

  async createServer(i: CreateServerInput) {
    if (!i.eggId || !i.nestId) throw new ProvisioningError("Pakiet nie ma przypisanych eggId/nestId Pterodactyl", false);
    if (!i.allocation.externalId) throw new ProvisioningError("Alokacja nie jest zsynchronizowana z Pterodactyl (uruchom synchronizację węzłów)", false);
    // Idempotencja: serwer z tym external_id już istnieje (np. po awarii po utworzeniu)
    const dup = await app("GET", `/servers/external/${encodeURIComponent(i.idempotencyKey)}`).catch((e: ProvisioningError) => (/HTTP 404/.test(e.message) ? null : Promise.reject(e)));
    if (dup?.attributes) return { externalId: String(dup.attributes.id), externalUuid: String(dup.attributes.uuid) };
    const owner = await this.ensureUser(i.ownerEmail, i.ownerName);
    const egg = (await app("GET", `/nests/${i.nestId}/eggs/${i.eggId}?include=variables`)).attributes;
    const environment: Record<string, string | number> = {};
    for (const v of egg.relationships?.variables?.data ?? []) {
      const a = v.attributes;
      // Klient może nadpisać wyłącznie zmienne, które egg oznacza jako user_editable (np. SRCDS_TOKEN); resztę ustala egg/admin.
      const custom = a.user_editable === true ? i.envVars?.[a.env_variable] : undefined;
      let value: string | number = i.systemVars?.[a.env_variable] ?? (custom !== undefined && custom !== "" ? custom : a.default_value ?? "");
      // Panel waliduje reguły egga przy POST /servers: pusta wymagana zmienna = HTTP 422 (np. CS2: RCON_PASSWORD, STEAM_GSLT).
      if (value === "" && /\brequired\b/.test(a.rules ?? "") && !/\bnullable\b/.test(a.rules ?? "")) {
        if (a.env_variable === "RCON_PASSWORD") value = randomBytes(12).toString("hex"); // alpha_dash, 24 znaki; hasło jest w panelu/Client API
        else throw new ProvisioningError(`Wymagana zmienna egga ${a.env_variable} (${a.name ?? ""}) nie została podana w zamówieniu`, false);
      }
      environment[a.env_variable] = value;
    }
    const extraIds = (i.extraAllocations ?? []).map((e) => e.externalId).filter((x): x is number => x != null);
    if ((i.extraAllocations ?? []).length !== extraIds.length) throw new ProvisioningError("Dodatkowa alokacja nie jest zsynchronizowana z Pterodactyl (uruchom synchronizację węzłów)", false);
    const r = await app("POST", "/servers", {
      name: i.name, user: owner, egg: i.eggId, docker_image: i.dockerImage ?? egg.docker_image, startup: egg.startup,
      environment, external_id: i.idempotencyKey,
      limits: { memory: i.ramMb, swap: 0, disk: i.diskMb, io: 500, cpu: i.cpuPercent },
      feature_limits: { databases: 0, backups: 3, allocations: 1 + extraIds.length },
      allocation: { default: i.allocation.externalId, ...(extraIds.length ? { additional: extraIds } : {}) }, start_on_completion: false,
    });
    return { externalId: String(r.attributes.id), externalUuid: String(r.attributes.uuid) };
  }

  async power(s: { externalUuid: string | null; eulaAccepted?: boolean }, action: PowerAction): Promise<ServerStatus> {
    if (!s.externalUuid) throw new ProvisioningError("Serwer nie ma uuid Pterodactyl", false);
    // Minecraft nie wystartuje bez eula.txt (eula=true). Klient zaakceptował EULA przy zamówieniu — zapisujemy plik przed startem.
    if (s.eulaAccepted && (action === "start" || action === "restart")) await writeFile(s.externalUuid, "/eula.txt", "eula=true\n");
    const signal = action;
    await client("POST", `/servers/${s.externalUuid.slice(0, 8)}/power`, { signal });
    return action === "start" || action === "restart" ? "STARTING" : "STOPPING"; // stan końcowy ustala resources()
  }

  async resources(s: { externalUuid: string | null }) {
    if (!s.externalUuid) return null;
    const a = (await client("GET", `/servers/${s.externalUuid.slice(0, 8)}/resources`)).attributes;
    const r = a.resources ?? {};
    return { state: STATE[a.current_state] ?? "OFFLINE", cpu: Math.round((r.cpu_absolute ?? 0) * 10) / 10,
      ramMb: Math.round((r.memory_bytes ?? 0) / 1048576), diskMb: Math.round((r.disk_bytes ?? 0) / 1048576),
      netInKb: Math.round((r.network_rx_bytes ?? 0) / 1024), netOutKb: Math.round((r.network_tx_bytes ?? 0) / 1024) };
  }

  async suspend(s: { externalId: string | null }, suspended: boolean) {
    if (s.externalId) await app("POST", `/servers/${s.externalId}/${suspended ? "suspend" : "unsuspend"}`);
  }
  async deleteServer(s: { externalId: string | null }) {
    if (s.externalId) await app("DELETE", `/servers/${s.externalId}`);
  }
}
