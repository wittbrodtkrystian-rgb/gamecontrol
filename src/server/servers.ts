import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ApiError, notFound } from "@/lib/errors";
import { getAdapter } from "./provisioning";
import type { ServerStatus } from "@prisma/client";

type Actor = { id: string; role: string };
export const powerSchema = z.object({ action: z.enum(["start", "stop", "restart", "kill"]) });
export const commandSchema = z.object({ command: z.string().trim().min(1).max(200).regex(/^[^\x00-\x1f\x7f]+$/, "Niedozwolone znaki sterujące") });
const CONTROLLABLE: ServerStatus[] = ["OFFLINE", "RUNNING", "STARTING", "STOPPING"];

/** Serwer widoczny tylko dla właściciela; obcy zasób zwraca 404 (brak ujawniania istnienia). */
export async function getServerFor(actor: Actor, id: string) {
  const s = await db.server.findFirst({
    where: { id, ...(actor.role === "CUSTOMER" ? { userId: actor.id } : {}) },
    include: { plan: { include: { game: true } }, node: true, allocation: true, subscription: true },
  });
  if (!s) throw notFound();
  return s;
}

export async function powerServer(actor: Actor, id: string, action: z.infer<typeof powerSchema>["action"]) {
  const s = await getServerFor(actor, id);
  if (!CONTROLLABLE.includes(s.status)) throw new ApiError(409, "BAD_STATE", "Serwer nie jest gotowy do sterowania");
  if (s.subscription && s.subscription.status !== "ACTIVE") throw new ApiError(402, "SUBSCRIPTION_INACTIVE", "Usługa wygasła — odnów abonament");
  const status = await getAdapter().power(s, action);
  await db.server.update({ where: { id }, data: { status } });
  await audit(actor.id, `server.${action}`, "Server", id);
  return { status };
}

/** Konsola gry (nie powłoka systemowa): polecenie trafia do procesu gry przez API. W DEMO jest tylko symulowane. */
export async function sendCommand(actor: Actor, id: string, command: string) {
  const s = await getServerFor(actor, id);
  if (s.status !== "RUNNING") throw new ApiError(409, "NOT_RUNNING", "Serwer musi być uruchomiony");
  if (!s.isDemo) throw new ApiError(501, "NOT_IMPLEMENTED", "Konsola produkcyjna wymaga integracji Pterodactyl (Etap 2)");
  await audit(actor.id, "server.command", "Server", id, { length: command.length });
  return { lines: [`> ${command}`, "[DEMO] Polecenie przyjęte — serwer demonstracyjny nie wykonuje komend."] };
}

/** Metryki DEMO generowane przy odczycie, gdy serwer działa. Prawdziwe metryki: Etap 2 (Wings/Client API). */
export async function getMetrics(actor: Actor, id: string) {
  const s = await getServerFor(actor, id);
  if (s.isDemo && s.status === "RUNNING") {
    const last = await db.serverMetric.findFirst({ where: { serverId: id }, orderBy: { ts: "desc" } });
    if (!last || Date.now() - last.ts.getTime() > 30_000) {
      const wave = Math.sin(Date.now() / 60000);
      await db.serverMetric.create({ data: { serverId: id, cpu: Math.round((35 + 25 * wave + Math.random() * 8) * 10) / 10, ramMb: Math.round(s.ramMb * (0.55 + 0.1 * wave)), diskMb: Math.round(s.diskMb * 0.18), netInKb: Math.round(200 + Math.random() * 300), netOutKb: Math.round(400 + Math.random() * 600), players: Math.floor(Math.random() * Math.min(s.slots, 12)) } });
    }
  }
  if (!s.isDemo && s.externalUuid && ["RUNNING", "STARTING", "STOPPING", "OFFLINE"].includes(s.status)) {
    const res = await getAdapter().resources?.(s).catch(() => null);
    if (res) {
      if (res.state !== s.status) await db.server.update({ where: { id }, data: { status: res.state } });
      if (res.state === "RUNNING") await db.serverMetric.create({ data: { serverId: id, cpu: res.cpu, ramMb: res.ramMb, diskMb: res.diskMb, netInKb: res.netInKb, netOutKb: res.netOutKb } });
    }
  }
  const rows = await db.serverMetric.findMany({ where: { serverId: id }, orderBy: { ts: "desc" }, take: 60 });
  return { demo: s.isDemo, limits: { ramMb: s.ramMb, diskMb: s.diskMb, cpuPercent: s.cpuPercent }, points: rows.reverse().map((r) => ({ ts: r.ts, cpu: r.cpu, ramMb: r.ramMb, diskMb: r.diskMb, netInKb: r.netInKb, netOutKb: r.netOutKb, players: r.players })) };
}

const MAX_BACKUPS = 3;
export async function createBackup(actor: Actor, id: string) {
  const s = await getServerFor(actor, id);
  if (await db.backup.count({ where: { serverId: id } }) >= MAX_BACKUPS) throw new ApiError(409, "BACKUP_LIMIT", `Limit kopii zapasowych: ${MAX_BACKUPS}`);
  const b = await db.backup.create({ data: { serverId: id, name: `Kopia ${new Date().toLocaleString("pl-PL")}`, status: s.isDemo ? "READY" : "CREATING", sizeMb: s.isDemo ? Math.round(s.diskMb * 0.1) : 0 } });
  await audit(actor.id, "backup.created", "Backup", b.id);
  return b;
}
export async function deleteBackup(actor: Actor, serverId: string, backupId: string) {
  await getServerFor(actor, serverId);
  const r = await db.backup.deleteMany({ where: { id: backupId, serverId, locked: false } });
  if (r.count === 0) throw notFound();
  await audit(actor.id, "backup.deleted", "Backup", backupId);
}
