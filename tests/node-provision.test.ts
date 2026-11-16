import http from "http";
import type { AddressInfo } from "net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb, makeUser } from "./helpers";
import { parsePorts, provisionNode, provisionNodeSchema, buildWingsInstallScript } from "@/server/node-provision";

// MOCK API Pterodactyl — sprawdza naszą logikę żądań, NIE prawdziwy panel.
let srv: http.Server; const calls: { method: string; url: string; body?: any }[] = []; let failConfig = false;
beforeAll(async () => {
  srv = http.createServer((rq, rs) => {
    let raw = ""; rq.on("data", (c) => (raw += c)); rq.on("end", () => {
      const body = raw ? JSON.parse(raw) : undefined; const url = rq.url!; calls.push({ method: rq.method!, url, body });
      const send = (code: number, o?: unknown) => { rs.writeHead(code, { "content-type": "application/json" }); rs.end(o === undefined ? "" : JSON.stringify(o)); };
      if (url.startsWith("/api/application/locations?filter")) return send(200, { data: [] });
      if (url === "/api/application/locations" && rq.method === "POST") return send(201, { attributes: { id: 9 } });
      if (url === "/api/application/nodes" && rq.method === "POST") return send(201, { attributes: { id: 4 } });
      if (url === "/api/application/nodes/4/allocations" && rq.method === "POST") return send(204);
      if (url === "/api/application/nodes/4/configuration") return failConfig ? send(500, {}) : send(200, { uuid: "u-1", token_id: "tid", token: "SEKRET-TOKEN", api: { port: 8080 }, remote: "https://panel.example" });
      if (url === "/api/application/nodes/4" && rq.method === "DELETE") return send(204);
      if (url.startsWith("/api/application/nodes?")) return send(200, { data: [{ attributes: { id: 4, name: "wings-pl-1", fqdn: "node1.example.pl", memory: 32768, memory_overallocate: 0, disk: 900000, disk_overallocate: 0, maintenance_mode: false } }] });
      if (url.startsWith("/api/application/nodes/4/allocations")) return send(200, { data: [{ attributes: { id: 1, ip: "203.0.113.10", port: 25565 } }], meta: { pagination: { total_pages: 1 } } });
      send(404, {});
    });
  });
  await new Promise<void>((r) => srv.listen(0, r));
  process.env.PTERODACTYL_URL = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`; process.env.PTERODACTYL_APP_API_KEY = "ptla_test";
  process.env.DEMO_MODE = "false";
});
afterAll(() => { srv.close(); delete process.env.DEMO_MODE; });
beforeEach(async () => { await resetDb(); calls.length = 0; failConfig = false; });

const valid = { name: "wings-pl-1", fqdn: "node1.example.pl", ip: "203.0.113.10", scheme: "https" as const, memoryMb: 32768, diskMb: 900000, cpuPercent: 1200, ports: "25565-25599, 27015", daemonPort: 8080, sftpPort: 2022 };

describe("dodawanie węzła (etap A)", () => {
  it("parsuje i waliduje porty", () => {
    expect(parsePorts("25565-25599, 27015")).toEqual(["25565-25599", "27015"]);
    for (const bad of ["80", "70000", "25570-25565", "abc", "25565-30000,30001-31500", ""]) expect(() => parsePorts(bad)).toThrow();
  });
  it("odrzuca niebezpieczne dane wejściowe", () => {
    for (const bad of [{ ...valid, fqdn: "x; rm -rf /" }, { ...valid, name: "a$(id)" }, { ...valid, ip: "999.1.1.1" }, { ...valid, fqdn: "203.0.113.10" }]) expect(provisionNodeSchema.safeParse(bad).success).toBe(false);
    expect(provisionNodeSchema.safeParse({ ...valid, fqdn: "203.0.113.10", scheme: "http" }).success).toBe(true);
  });
  it("tworzy lokalizację, węzeł i alokacje w panelu, zapisuje węzeł z pulą CPU i zwraca skrypt z konfiguracją", async () => {
    const { user } = await makeUser("ADMIN");
    const r = await provisionNode(user.id, provisionNodeSchema.parse(valid));
    expect(calls.find((c) => c.url === "/api/application/locations" && c.method === "POST")?.body).toMatchObject({ short: "gamecontrol" });
    expect(calls.find((c) => c.url === "/api/application/nodes" && c.method === "POST")?.body).toMatchObject({ name: "wings-pl-1", location_id: 9, fqdn: "node1.example.pl", scheme: "https", memory: 32768, disk: 900000, daemon_listen: 8080, daemon_sftp: 2022 });
    expect(calls.find((c) => c.url === "/api/application/nodes/4/allocations" && c.method === "POST")?.body).toEqual({ ip: "203.0.113.10", ports: ["25565-25599", "27015"] });
    expect(await db.node.findUniqueOrThrow({ where: { id: r.nodeId } })).toMatchObject({ pterodactylNodeId: 4, cpuTotal: 1200 });
    expect(r.script).toContain("SEKRET-TOKEN");
    expect(r.script).toContain("--auto-tls --tls-hostname node1.example.pl");
    expect(r.script).toContain("ufw allow 25565:25599/udp");
    const log = await db.auditLog.findFirstOrThrow({ where: { action: "admin.node.provisioned" } });
    expect(JSON.stringify(log)).not.toContain("SEKRET-TOKEN"); // token nie trafia do audytu
  });
  it("przy błędzie po utworzeniu węzła usuwa go z panelu (brak sieroty)", async () => {
    const { user } = await makeUser("ADMIN"); failConfig = true;
    await expect(provisionNode(user.id, provisionNodeSchema.parse(valid))).rejects.toBeTruthy();
    expect(calls.some((c) => c.method === "DELETE" && c.url === "/api/application/nodes/4")).toBe(true);
    expect(await db.node.count()).toBe(0);
  });
  it("odmawia w trybie DEMO i przy zdublowanej nazwie", async () => {
    const { user } = await makeUser("ADMIN");
    await provisionNode(user.id, provisionNodeSchema.parse(valid));
    await expect(provisionNode(user.id, provisionNodeSchema.parse(valid))).rejects.toMatchObject({ status: 409 });
    process.env.DEMO_MODE = "true";
    try { await expect(provisionNode(user.id, provisionNodeSchema.parse({ ...valid, name: "inny-wezel" }))).rejects.toMatchObject({ status: 400 }); } finally { process.env.DEMO_MODE = "false"; }
  });
  it("skrypt w trybie HTTP nie używa auto-tls", () => {
    const s = buildWingsInstallScript({ config: "{}", fqdn: "1.2.3.4", scheme: "http", daemonPort: 8080, sftpPort: 2022, ports: ["25565"] });
    expect(s).not.toContain("--auto-tls"); expect(s).toContain("ExecStart=/usr/local/bin/wings");
  });
});
