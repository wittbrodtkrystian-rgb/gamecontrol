import http from "http";
import type { AddressInfo } from "net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb, seedCatalog, makeUser } from "./helpers";
import { setAdapterForTests } from "@/server/provisioning";
import { PterodactylAdapter } from "@/server/provisioning/pterodactyl";
import { createOrder } from "@/server/orders";
import { settlePayment } from "@/server/payments";
import { syncNodes } from "@/server/nodes-sync";
import { createBackup, deleteBackup, listBackups, restoreBackup } from "@/server/servers";

// MOCK API Pterodactyl — sprawdza naszą logikę kopii zapasowych, NIE prawdziwy panel.
let srv: http.Server; const calls: { method: string; url: string; body?: any }[] = [];
let done = false, success = true, bytes = 0, deleteStatus = 204, n = 0;
beforeAll(async () => {
  srv = http.createServer((rq, rs) => {
    let raw = ""; rq.on("data", (c) => (raw += c)); rq.on("end", () => {
      let body: any; try { body = raw ? JSON.parse(raw) : undefined; } catch { body = undefined; } const url = rq.url!; calls.push({ method: rq.method!, url, body });
      const json = (code: number, o?: unknown) => { rs.writeHead(code, { "content-type": "application/json" }); rs.end(o === undefined ? "" : JSON.stringify(o)); };
      if (url.startsWith("/api/application/users?filter")) return json(200, { data: [] });
      if (url === "/api/application/users" && rq.method === "POST") return json(201, { attributes: { id: 7 } });
      if (url.startsWith("/api/application/nests/1/eggs/5")) return json(200, { attributes: { docker_image: "img", startup: "java", relationships: { variables: { data: [] } } } });
      if (url.startsWith("/api/application/servers/external/")) return json(404, {});
      if (url === "/api/application/servers" && rq.method === "POST") return json(201, { attributes: { id: 42, uuid: "abcdef12-0000-0000-0000-000000000000" } });
      if (url.startsWith("/api/application/nodes?")) return json(200, { data: [{ attributes: { id: 3, name: "w", fqdn: "w.local", memory: 8192, memory_overallocate: 0, disk: 50000, disk_overallocate: 0, maintenance_mode: false } }] });
      if (url.startsWith("/api/application/nodes/3/allocations")) return json(200, { data: [{ attributes: { id: 100, ip: "10.0.0.1", port: 25565 } }], meta: { pagination: { total_pages: 1 } } });
      if (url === "/api/client/servers/abcdef12/backups" && rq.method === "POST") return json(200, { attributes: { uuid: `bk-${++n}`, name: body?.name } });
      if (/^\/api\/client\/servers\/abcdef12\/backups\/bk-\d+$/.test(url) && rq.method === "GET") return json(200, { attributes: { completed_at: done ? "2026-01-01T00:00:00Z" : null, is_successful: done ? success : null, bytes } });
      if (/^\/api\/client\/servers\/abcdef12\/backups\/bk-\d+$/.test(url) && rq.method === "DELETE") return json(deleteStatus, deleteStatus === 204 ? undefined : {});
      if (/\/backups\/bk-\d+\/restore$/.test(url) && rq.method === "POST") return json(204);
      json(404, {});
    });
  });
  await new Promise<void>((r) => srv.listen(0, r));
  process.env.PTERODACTYL_URL = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`; process.env.PTERODACTYL_APP_API_KEY = "ptla_test"; process.env.PTERODACTYL_CLIENT_API_KEY = "ptlc_test";
});
afterAll(() => { srv.close(); setAdapterForTests(null); });
beforeEach(async () => { await resetDb(); calls.length = 0; done = false; success = true; bytes = 0; deleteStatus = 204; n = 0; setAdapterForTests(new PterodactylAdapter()); });

async function setup() {
  const { plan } = await seedCatalog({ allocations: 0 }); await db.node.deleteMany();
  await db.hostingPlan.update({ where: { id: plan.id }, data: { pterodactylNestId: 1, pterodactylEggId: 5 } });
  await syncNodes(null);
  const u = await makeUser("CUSTOMER"); const other = await makeUser("CUSTOMER");
  const o = await createOrder(u.user.id, { items: [{ planId: plan.id, serverName: "Kopie", acceptEula: true }] });
  await settlePayment({ orderId: o.id, provider: "DEMO", providerRef: "r", eventId: "e" });
  const server = await db.server.findFirstOrThrow(); calls.length = 0;
  return { actor: { id: u.user.id, role: "CUSTOMER" }, other: { id: other.user.id, role: "CUSTOMER" }, server };
}

describe("prawdziwe kopie zapasowe (Client API Pterodactyla)", () => {
  it("tworzy kopię w panelu, a status CREATING zmienia się na READY dopiero po zakończeniu", async () => {
    const { actor, server } = await setup();
    const b = await createBackup(actor, server.id);
    expect(calls.find((c) => c.method === "POST" && c.url.endsWith("/backups"))!.body).toMatchObject({ name: expect.stringContaining("Kopia") });
    expect(b).toMatchObject({ status: "CREATING", externalId: "bk-1" });
    expect((await listBackups(actor, server.id))[0].status).toBe("CREATING");
    done = true; bytes = 5 * 1048576;
    expect((await listBackups(actor, server.id))[0]).toMatchObject({ status: "READY", sizeMb: 5 });
  });
  it("oznacza nieudaną kopię jako FAILED", async () => {
    const { actor, server } = await setup();
    await createBackup(actor, server.id); done = true; success = false;
    expect((await listBackups(actor, server.id))[0].status).toBe("FAILED");
  });
  it("usuwa kopię w panelu i w bazie, także gdy panel już jej nie ma (404)", async () => {
    const { actor, server } = await setup();
    const b = await createBackup(actor, server.id);
    await deleteBackup(actor, server.id, b.id);
    expect(calls.some((c) => c.method === "DELETE" && c.url.endsWith("/backups/bk-1"))).toBe(true);
    expect(await db.backup.count()).toBe(0);
    const b2 = await createBackup(actor, server.id); deleteStatus = 404;
    await deleteBackup(actor, server.id, b2.id);
    expect(await db.backup.count()).toBe(0);
  });
  it("przywraca kopię (truncate) tylko gdy jest gotowa, serwer zatrzymany, a właściciel się zgadza", async () => {
    const { actor, other, server } = await setup();
    const b = await createBackup(actor, server.id);
    await expect(restoreBackup(actor, server.id, b.id)).rejects.toMatchObject({ code: "BACKUP_NOT_READY" });
    done = true; await listBackups(actor, server.id);
    await expect(restoreBackup(other, server.id, b.id)).rejects.toMatchObject({ status: 404 });
    await db.server.update({ where: { id: server.id }, data: { status: "INSTALLING" } });
    await expect(restoreBackup(actor, server.id, b.id)).rejects.toMatchObject({ code: "NOT_OFFLINE" });
    await db.server.update({ where: { id: server.id }, data: { status: "OFFLINE" } });
    expect(await restoreBackup(actor, server.id, b.id)).toEqual({ restoring: true });
    const r = calls.find((c) => c.url.endsWith("/restore"))!;
    expect(r.url).toBe("/api/client/servers/abcdef12/backups/bk-1/restore"); expect(r.body).toEqual({ truncate: true });
    expect(await db.auditLog.count({ where: { action: "backup.restored" } })).toBe(1);
  });
  it("respektuje limit 3 kopii i wygasły abonament oraz nie wywołuje panelu przy odmowie", async () => {
    const { actor, server } = await setup();
    for (let i = 0; i < 3; i++) await createBackup(actor, server.id);
    await expect(createBackup(actor, server.id)).rejects.toMatchObject({ code: "BACKUP_LIMIT" });
    await db.backup.deleteMany(); calls.length = 0;
    await db.subscription.updateMany({ data: { status: "PAST_DUE" } });
    await expect(createBackup(actor, server.id)).rejects.toMatchObject({ status: 402 });
    expect(calls.some((c) => c.url.includes("/backups"))).toBe(false);
  });
});
