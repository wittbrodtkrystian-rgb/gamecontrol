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
import { changeEngine } from "@/server/engine-change";
import { getServerFor } from "@/server/servers";

// MOCK API Pterodactyl — sprawdza naszą logikę, NIE prawdziwy panel.
let srv: http.Server; const calls: { method: string; url: string; body?: any }[] = []; let installing = false;
const engineEggs = [{ key: "paper", label: "Paper", nestId: 1, eggId: 5, versionVar: "MINECRAFT_VERSION" }, { key: "vanilla", label: "Vanilla", nestId: 1, eggId: 6, versionVar: "VANILLA_VERSION" }];
const egg = (v: string) => ({ attributes: { docker_image: "img-" + v, startup: "java -jar " + v, relationships: { variables: { data: [{ attributes: { env_variable: v, default_value: "latest", user_editable: true } }, { attributes: { env_variable: "SERVER_JARFILE", default_value: "server.jar", user_editable: true } }] } } } });
beforeAll(async () => {
  srv = http.createServer((rq, rs) => {
    let raw = ""; rq.on("data", (c) => (raw += c)); rq.on("end", () => {
      let body: any; try { body = raw ? JSON.parse(raw) : undefined; } catch { body = undefined; } const url = rq.url!; calls.push({ method: rq.method!, url, body });
      const json = (code: number, o?: unknown) => { rs.writeHead(code, { "content-type": "application/json" }); rs.end(o === undefined ? "" : JSON.stringify(o)); };
      if (url.startsWith("/api/application/users?filter")) return json(200, { data: [] });
      if (url === "/api/application/users" && rq.method === "POST") return json(201, { attributes: { id: 7 } });
      if (url.startsWith("/api/application/nests/1/eggs/5")) return json(200, egg("MINECRAFT_VERSION"));
      if (url.startsWith("/api/application/nests/1/eggs/6")) return json(200, egg("VANILLA_VERSION"));
      if (url.startsWith("/api/application/servers/external/")) return json(404, {});
      if (url === "/api/application/servers" && rq.method === "POST") return json(201, { attributes: { id: 42, uuid: "abcdef12-0000-0000-0000-000000000000" } });
      if (url === "/api/application/servers/42" && rq.method === "GET") return json(200, { attributes: { id: 42, status: installing ? "installing" : null } });
      if (url === "/api/application/servers/42/startup" && rq.method === "PATCH") return json(200, { attributes: {} });
      if (url === "/api/application/servers/42/reinstall" && rq.method === "POST") return json(204);
      if (url.startsWith("/api/application/nodes?")) return json(200, { data: [{ attributes: { id: 3, name: "w", fqdn: "w.local", memory: 8192, memory_overallocate: 0, disk: 50000, disk_overallocate: 0, maintenance_mode: false } }] });
      if (url.startsWith("/api/application/nodes/3/allocations")) return json(200, { data: [{ attributes: { id: 100, ip: "10.0.0.1", port: 25565 } }], meta: { pagination: { total_pages: 1 } } });
      json(404, {});
    });
  });
  await new Promise<void>((r) => srv.listen(0, r));
  process.env.PTERODACTYL_URL = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`; process.env.PTERODACTYL_APP_API_KEY = "ptla_test"; process.env.PTERODACTYL_CLIENT_API_KEY = "ptlc_test";
});
afterAll(() => { srv.close(); setAdapterForTests(null); });
beforeEach(async () => { await resetDb(); calls.length = 0; installing = false; setAdapterForTests(new PterodactylAdapter()); });

async function setup() {
  const { game, plan } = await seedCatalog({ allocations: 0 }); await db.node.deleteMany();
  await db.game.update({ where: { id: game.id }, data: { features: { engineEggs } } });
  await db.hostingPlan.update({ where: { id: plan.id }, data: { pterodactylNestId: 1, pterodactylEggId: 5 } });
  await syncNodes(null);
  const u = await makeUser("CUSTOMER"); const other = await makeUser("CUSTOMER");
  const o = await createOrder(u.user.id, { items: [{ planId: plan.id, serverName: "Silnik", engine: "paper", version: "latest", acceptEula: true }] });
  await settlePayment({ orderId: o.id, provider: "DEMO", providerRef: "r", eventId: "e" });
  const server = await db.server.findFirstOrThrow(); calls.length = 0;
  return { actor: { id: u.user.id, role: "CUSTOMER" }, other: { id: other.user.id, role: "CUSTOMER" }, server };
}

describe("zmiana silnika i wersji (reinstalacja)", () => {
  it("wysyła nowy egg i zmienne do panelu, uruchamia reinstalację i zapisuje wybór", async () => {
    const { actor, server } = await setup();
    expect(await changeEngine(actor, server.id, { engine: "vanilla", version: "1.21.4" })).toEqual({ status: "INSTALLING" });
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.url).toBe("/api/application/servers/42/startup");
    expect(patch.body).toMatchObject({ egg: 6, image: "img-VANILLA_VERSION", startup: "java -jar VANILLA_VERSION", skip_scripts: false, environment: { VANILLA_VERSION: "1.21.4", SERVER_JARFILE: "server.jar" } });
    expect(calls.some((c) => c.method === "POST" && c.url === "/api/application/servers/42/reinstall")).toBe(true);
    expect((await db.server.findUniqueOrThrow({ where: { id: server.id } })).status).toBe("INSTALLING");
    expect((await db.orderItem.findFirstOrThrow()).config).toMatchObject({ engine: "vanilla", version: "1.21.4", acceptEula: true });
    expect(await db.auditLog.count({ where: { action: "server.engine.changed" } })).toBe(1);
  });
  it("odrzuca nieznany silnik, złą wersję, cudzy serwer, uruchomiony serwer i wygasły abonament", async () => {
    const { actor, other, server } = await setup();
    await expect(changeEngine(actor, server.id, { engine: "magma", version: "latest" })).rejects.toMatchObject({ code: "BAD_ENGINE" });
    await expect(changeEngine(other, server.id, { engine: "paper", version: "latest" })).rejects.toMatchObject({ status: 404 });
    await db.server.update({ where: { id: server.id }, data: { status: "RUNNING" } });
    await expect(changeEngine(actor, server.id, { engine: "paper", version: "latest" })).rejects.toMatchObject({ code: "NOT_OFFLINE" });
    await db.server.update({ where: { id: server.id }, data: { status: "OFFLINE" } });
    await db.subscription.updateMany({ data: { status: "PAST_DUE" } });
    await expect(changeEngine(actor, server.id, { engine: "paper", version: "latest" })).rejects.toMatchObject({ status: 402 });
    expect(calls.some((c) => c.method === "PATCH" || c.url.endsWith("/reinstall"))).toBe(false);
  });
  it("po zakończeniu instalacji w panelu serwer wraca do OFFLINE, a w trakcie zostaje INSTALLING", async () => {
    const { actor, server } = await setup();
    await changeEngine(actor, server.id, { engine: "paper", version: "1.20.6" });
    installing = true; expect((await getServerFor(actor, server.id)).status).toBe("INSTALLING");
    installing = false; expect((await getServerFor(actor, server.id)).status).toBe("OFFLINE");
    expect((await db.server.findUniqueOrThrow({ where: { id: server.id } })).status).toBe("OFFLINE");
  });
});
