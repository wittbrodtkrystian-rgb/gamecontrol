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
import { safePath, safeName, listFiles, readFileText, writeFileText, makeFolder, deleteFiles, renameFile } from "@/server/files";

// MOCK API Pterodactyl (Client API plików) — sprawdza naszą logikę, NIE prawdziwy panel.
let srv: http.Server; const calls: { method: string; url: string; body?: any; raw?: string }[] = [];
let big = false, binary = false;
beforeAll(async () => {
  srv = http.createServer((rq, rs) => {
    let raw = ""; rq.on("data", (c) => (raw += c)); rq.on("end", () => {
      let body: any; try { body = raw ? JSON.parse(raw) : undefined; } catch { body = undefined; }
      const url = rq.url!; calls.push({ method: rq.method!, url, body, raw });
      const json = (code: number, o?: unknown) => { rs.writeHead(code, { "content-type": "application/json" }); rs.end(o === undefined ? "" : JSON.stringify(o)); };
      if (url.startsWith("/api/application/users?filter")) return json(200, { data: [] });
      if (url === "/api/application/users" && rq.method === "POST") return json(201, { attributes: { id: 7 } });
      if (url.startsWith("/api/application/nests/1/eggs/5")) return json(200, { attributes: { docker_image: "img", startup: "x", relationships: { variables: { data: [] } } } });
      if (url.startsWith("/api/application/servers/external/")) return json(404, {});
      if (url === "/api/application/servers" && rq.method === "POST") return json(201, { attributes: { id: 42, uuid: "abcdef12-0000-0000-0000-000000000000" } });
      if (url.startsWith("/api/application/nodes?")) return json(200, { data: [{ attributes: { id: 3, name: "w", fqdn: "w.local", memory: 8192, memory_overallocate: 0, disk: 50000, disk_overallocate: 0, maintenance_mode: false } }] });
      if (url.startsWith("/api/application/nodes/3/allocations")) return json(200, { data: [{ attributes: { id: 100, ip: "10.0.0.1", port: 25565 } }], meta: { pagination: { total_pages: 1 } } });
      if (url.startsWith("/api/client/servers/abcdef12/files/list")) return json(200, { data: [
        { attributes: { name: "world", is_file: false, size: 4096, modified_at: "2026-01-01T00:00:00Z", mimetype: "inode/directory" } },
        { attributes: { name: "server.properties", is_file: true, size: big ? 5_000_000 : 120, modified_at: "2026-01-02T00:00:00Z", mimetype: "text/plain" } },
        { attributes: { name: "a.txt", is_file: true, size: 3, modified_at: "2026-01-02T00:00:00Z", mimetype: "text/plain" } },
      ] });
      if (url.startsWith("/api/client/servers/abcdef12/files/contents")) { rs.writeHead(200, { "content-type": "text/plain" }); return rs.end(binary ? "AB\u0000CD" : "motd=Hello\n"); }
      if (url.includes("/files/write") || url.includes("/files/create-folder") || url.includes("/files/delete") || url.includes("/files/rename")) return json(204);
      json(404, {});
    });
  });
  await new Promise<void>((r) => srv.listen(0, r));
  process.env.PTERODACTYL_URL = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`; process.env.PTERODACTYL_APP_API_KEY = "ptla_test"; process.env.PTERODACTYL_CLIENT_API_KEY = "ptlc_test";
});
afterAll(() => { srv.close(); setAdapterForTests(null); });
beforeEach(async () => { await resetDb(); calls.length = 0; big = false; binary = false; setAdapterForTests(new PterodactylAdapter()); });

async function setup() {
  const { plan } = await seedCatalog({ allocations: 0 }); await db.node.deleteMany();
  await db.hostingPlan.update({ where: { id: plan.id }, data: { pterodactylEggId: 5, pterodactylNestId: 1 } });
  await syncNodes(null);
  const u = await makeUser("CUSTOMER"); const other = await makeUser("CUSTOMER");
  const o = await createOrder(u.user.id, { items: [{ planId: plan.id, serverName: "Pliki", acceptEula: true }] });
  await settlePayment({ orderId: o.id, provider: "DEMO", providerRef: "r", eventId: "e" });
  const server = await db.server.findFirstOrThrow();
  calls.length = 0;
  return { actor: { id: u.user.id, role: "CUSTOMER" }, other: { id: other.user.id, role: "CUSTOMER" }, server };
}

describe("walidacja ścieżek", () => {
  it("normalizuje i odrzuca ucieczkę poza katalog serwera", () => {
    expect(safePath("")).toBe("/"); expect(safePath("a//b/./c/")).toBe("/a/b/c");
    for (const bad of ["../etc/passwd", "/a/../../b", "a\\b", "/a\u0000b", "x".repeat(600), 5, null]) expect(() => safePath(bad)).toThrow();
    for (const bad of ["", ".", "..", "a/b", "a\\b", "x".repeat(300), "a\nb"]) expect(() => safeName(bad)).toThrow();
    expect(safeName("server.properties")).toBe("server.properties");
  });
});

describe("menedżer plików (mock Client API)", () => {
  it("listuje katalogi przed plikami i czyta plik tekstowy", async () => {
    const { actor, server } = await setup();
    const l = await listFiles(actor, server.id, "/");
    expect(l.entries.map((e) => e.name)).toEqual(["world", "a.txt", "server.properties"]);
    expect(await readFileText(actor, server.id, "/server.properties")).toMatchObject({ content: "motd=Hello\n", path: "/server.properties" });
  });
  it("cudzy serwer = 404 (IDOR), także przy zapisie", async () => {
    const { other, server } = await setup();
    await expect(listFiles(other, server.id, "/")).rejects.toMatchObject({ status: 404 });
    await expect(writeFileText(other, server.id, { path: "/x", content: "y" })).rejects.toMatchObject({ status: 404 });
    expect(calls.some((c) => c.url.includes("/files/"))).toBe(false);
  });
  it("odrzuca path traversal i nie dochodzi do Pterodactyla", async () => {
    const { actor, server } = await setup();
    await expect(readFileText(actor, server.id, "../../etc/passwd")).rejects.toMatchObject({ status: 400 });
    await expect(makeFolder(actor, server.id, { dir: "/", name: "../x" })).rejects.toMatchObject({ status: 400 });
    await expect(deleteFiles(actor, server.id, { dir: "/a/../..", names: ["x"] })).rejects.toMatchObject({ status: 400 });
    expect(calls.some((c) => c.url.includes("/files/"))).toBe(false);
  });
  it("odmawia edycji zbyt dużych i binarnych plików", async () => {
    const { actor, server } = await setup();
    big = true; await expect(readFileText(actor, server.id, "/server.properties")).rejects.toMatchObject({ status: 413 });
    big = false; binary = true; await expect(readFileText(actor, server.id, "/a.txt")).rejects.toMatchObject({ status: 415 });
    await expect(readFileText(actor, server.id, "/nie-ma.txt")).rejects.toMatchObject({ status: 404 });
  });
  it("zapis, folder, zmiana nazwy i usuwanie trafiają do Client API; audyt bez treści pliku", async () => {
    const { actor, server } = await setup();
    await writeFileText(actor, server.id, { path: "/server.properties", content: "sekret-w-tresci=1\n" });
    await makeFolder(actor, server.id, { dir: "/", name: "backup" });
    await renameFile(actor, server.id, { dir: "/", from: "a.txt", to: "b.txt" });
    await deleteFiles(actor, server.id, { dir: "/", names: ["b.txt"] });
    const w = calls.find((c) => c.url.includes("/files/write"))!; expect(w.url).toContain("file=%2Fserver.properties"); expect(w.raw).toBe("sekret-w-tresci=1\n");
    expect(calls.find((c) => c.url.includes("create-folder"))!.body).toEqual({ root: "/", name: "backup" });
    expect(calls.find((c) => c.url.includes("/files/rename"))!).toMatchObject({ method: "PUT", body: { root: "/", files: [{ from: "a.txt", to: "b.txt" }] } });
    expect(calls.find((c) => c.url.includes("/files/delete"))!.body).toEqual({ root: "/", files: ["b.txt"] });
    const logs = JSON.stringify(await db.auditLog.findMany({ where: { action: { startsWith: "server.file" } } }));
    expect(logs).toContain("server.file.write"); expect(logs).not.toContain("sekret-w-tresci");
  });
  it("wygasły abonament: odczyt działa, zapis zablokowany (402)", async () => {
    const { actor, server } = await setup();
    await db.subscription.updateMany({ data: { status: "PAST_DUE" } });
    await expect(listFiles(actor, server.id, "/")).resolves.toBeTruthy();
    await expect(writeFileText(actor, server.id, { path: "/a", content: "b" })).rejects.toMatchObject({ status: 402 });
  });
  it("adapter DEMO nie ma menedżera plików (501)", async () => {
    const { actor, server } = await setup(); setAdapterForTests(null);
    await expect(listFiles(actor, server.id, "/")).rejects.toMatchObject({ status: 501 });
  });
});
