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

// MOCK API Pterodactyl — sprawdza naszą logikę żądań, NIE prawdziwy panel.
let srv: http.Server; const calls: { method: string; url: string; auth?: string; body?: any }[] = [];
let servers: Record<string, any> = {}; let users: any[] = []; let state = "offline";
beforeAll(async () => {
  srv = http.createServer((rq, rs) => {
    let raw = ""; rq.on("data", (c) => (raw += c)); rq.on("end", () => {
      const body = raw ? JSON.parse(raw) : undefined; const url = rq.url!; calls.push({ method: rq.method!, url, auth: rq.headers.authorization, body });
      const send = (code: number, o: unknown) => { rs.writeHead(code, { "content-type": "application/json" }); rs.end(JSON.stringify(o)); };
      if (url.startsWith("/api/application/users?filter")) return send(200, { data: users.map((a) => ({ attributes: a })) });
      if (url === "/api/application/users" && rq.method === "POST") { const a = { id: 7, email: body.email }; users.push(a); return send(201, { attributes: a }); }
      if (url.startsWith("/api/application/nests/1/eggs/5")) return send(200, { attributes: { docker_image: "img", startup: "java -jar", relationships: { variables: { data: [{ attributes: { env_variable: "SERVER_JARFILE", default_value: "server.jar" } }] } } } });
      if (url.startsWith("/api/application/servers/external/")) { const s = servers[decodeURIComponent(url.split("/").pop()!)]; return s ? send(200, { attributes: s }) : send(404, { errors: [] }); }
      if (url === "/api/application/servers" && rq.method === "POST") { const s = { id: 42, uuid: "abcdef12-0000-0000-0000-000000000000", external_id: body.external_id }; servers[body.external_id] = s; return send(201, { attributes: s }); }
      if (url.startsWith("/api/application/nodes?")) return send(200, { data: [{ attributes: { id: 3, name: "wings1", fqdn: "w.local", memory: 8192, memory_overallocate: 0, disk: 50000, disk_overallocate: 0, maintenance_mode: false } }] });
      if (url.startsWith("/api/application/nodes/3/allocations")) return send(200, { data: [{ attributes: { id: 100, ip: "10.0.0.1", port: 25565 } }, { attributes: { id: 101, ip: "10.0.0.1", port: 25566 } }], meta: { pagination: { total_pages: 1 } } });
      if (url.endsWith("/power")) { state = body.signal === "start" ? "starting" : "stopping"; return send(204, {}); }
      if (url.endsWith("/resources")) return send(200, { attributes: { current_state: state, resources: { cpu_absolute: 12.34, memory_bytes: 1048576 * 512, disk_bytes: 1048576 * 100, network_rx_bytes: 2048, network_tx_bytes: 4096 } } });
      send(404, {});
    });
  });
  await new Promise<void>((r) => srv.listen(0, r));
  process.env.PTERODACTYL_URL = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
  process.env.PTERODACTYL_APP_API_KEY = "ptla_test"; process.env.PTERODACTYL_CLIENT_API_KEY = "ptlc_test";
});
afterAll(() => { srv.close(); setAdapterForTests(null); });
beforeEach(async () => { await resetDb(); calls.length = 0; servers = {}; users = []; state = "offline"; setAdapterForTests(new PterodactylAdapter()); });

describe("adapter Pterodactyl (mock API)", () => {
  it("synchronizuje węzły i alokacje, a potem tworzy serwer z poprawnym payloadem", async () => {
    const { plan } = await seedCatalog({ allocations: 0 });
    await db.node.deleteMany(); // tylko węzły z Pterodactyl
    await db.hostingPlan.update({ where: { id: plan.id }, data: { pterodactylEggId: 5, pterodactylNestId: 1 } });
    expect(await syncNodes(null)).toEqual({ nodes: 1, allocations: 2 });
    const u = await makeUser("CUSTOMER", "jan@kowalski.pl");
    const o = await createOrder(u.user.id, { items: [{ planId: plan.id, serverName: "Prawdziwy" }] });
    await settlePayment({ orderId: o.id, provider: "DEMO", providerRef: "r", eventId: "e" });
    const post = calls.find((c) => c.method === "POST" && c.url === "/api/application/servers")!;
    expect(post.auth).toBe("Bearer ptla_test");
    expect(post.body).toMatchObject({ user: 7, egg: 5, startup: "java -jar", allocation: { default: 100 }, limits: { memory: 2048, cpu: 100, disk: 10240 }, environment: { SERVER_JARFILE: "server.jar" } });
    const s = await db.server.findFirstOrThrow();
    expect(s).toMatchObject({ status: "OFFLINE", externalId: "42", isDemo: false });
  });
  it("ponowna próba po awarii nie tworzy duplikatu (external_id)", async () => {
    const a = new PterodactylAdapter(); const input = { name: "x", ownerEmail: "a@b.pl", ownerName: "A B", gameSlug: "m", ramMb: 1, cpuPercent: 1, diskMb: 1, node: { id: "n", pterodactylNodeId: 3 }, allocation: { ip: "1", port: 1, externalId: 100 }, nestId: 1, eggId: 5, dockerImage: null, idempotencyKey: "item-1" };
    const r1 = await a.createServer(input), r2 = await a.createServer(input);
    expect(r2).toEqual(r1); expect(calls.filter((c) => c.method === "POST" && c.url === "/api/application/servers")).toHaveLength(1);
  });
  it("zasilanie i stan przez Client API", async () => {
    const a = new PterodactylAdapter(); const s = { externalUuid: "abcdef12-0000" };
    expect(await a.power(s, "start")).toBe("STARTING");
    const call = calls.find((c) => c.url.endsWith("/power"))!; expect(call.url).toBe("/api/client/servers/abcdef12/power"); expect(call.auth).toBe("Bearer ptlc_test");
    state = "running"; expect(await a.resources(s)).toMatchObject({ state: "RUNNING", cpu: 12.3, ramMb: 512 });
  });
  it("brak eggId kończy się błędem nieponawialnym", async () => {
    await expect(new PterodactylAdapter().createServer({ eggId: null, nestId: null } as any)).rejects.toMatchObject({ retryable: false });
  });
});
