import { createHmac } from "crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb, seedCatalog, makeUser, req, ctx } from "./helpers";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as createOrderRoute } from "@/app/api/orders/route";
import { GET as getOrder } from "@/app/api/orders/[id]/route";
import { POST as payDemo } from "@/app/api/orders/[id]/pay-demo/route";
import { POST as power } from "@/app/api/servers/[id]/power/route";
import { POST as webhook } from "@/app/api/webhooks/payments/route";
import { PATCH as patchPlan } from "@/app/api/admin/plans/[id]/route";
import { POST as runJobs } from "@/app/api/internal/run-jobs/route";
import { createOrder } from "@/server/orders";
import { settlePayment, verifyWebhookSignature } from "@/server/payments";
import { processJob, runDueJobs } from "@/server/provisioning/service";
import { setAdapterForTests } from "@/server/provisioning";
import { DemoAdapter } from "@/server/provisioning/demo";
import { ProvisioningError } from "@/server/provisioning/adapter";

beforeEach(async () => { await resetDb(); setAdapterForTests(null); });
const none = ctx({});

async function paidOrder(userId: string, planId: string, name = "Mój serwer") {
  const o = await createOrder(userId, { items: [{ planId, serverName: name }] });
  await settlePayment({ orderId: o.id, provider: "DEMO", providerRef: `r_${o.id}`, eventId: `e_${o.id}` });
  return o;
}

describe("rejestracja i logowanie", () => {
  it("rejestruje, loguje, odrzuca złe hasło i blokuje po 5 próbach", async () => {
    const r = await register(req("POST", "/api/auth/register", { body: { email: "A@B.pl", name: "Ala", password: "dlugie-haslo-1" } }), none);
    expect(r.status).toBe(201);
    expect(r.headers.get("set-cookie")).toMatch(/HttpOnly/i);
    expect((await db.user.findUniqueOrThrow({ where: { email: "a@b.pl" } })).passwordHash).not.toContain("dlugie");
    expect((await register(req("POST", "/api/auth/register", { body: { email: "a@b.pl", name: "Ala", password: "dlugie-haslo-1" } }), none)).status).toBe(409);
    expect((await register(req("POST", "/api/auth/register", { body: { email: "x@b.pl", name: "X", password: "krotkie" } }), none)).status).toBe(400);
    expect((await login(req("POST", "/api/auth/login", { body: { email: "a@b.pl", password: "dlugie-haslo-1" } }), none)).status).toBe(200);
    for (let i = 0; i < 5; i++) expect((await login(req("POST", "/api/auth/login", { body: { email: "a@b.pl", password: "zle-zle-zle" } }), none)).status).toBe(401);
    expect((await login(req("POST", "/api/auth/login", { body: { email: "a@b.pl", password: "dlugie-haslo-1" } }), none)).status).toBe(423);
  });
  it("blokuje obcy Origin (CSRF)", async () => {
    const r = await register(req("POST", "/api/auth/register", { headers: { origin: "http://evil.example" }, body: { email: "c@b.pl", name: "Cc", password: "dlugie-haslo-1" } }), none);
    expect(r.status).toBe(403);
  });
});

describe("izolacja kont i uprawnienia", () => {
  it("klient nie widzi cudzego zamówienia ani serwera (IDOR) i nie steruje cudzym serwerem", async () => {
    const { plan } = await seedCatalog();
    const a = await makeUser("CUSTOMER"), b = await makeUser("CUSTOMER");
    const o = await paidOrder(a.user.id, plan.id);
    expect((await getOrder(req("GET", `/api/orders/${o.id}`, { token: a.token }), ctx({ id: o.id }))).status).toBe(200);
    expect((await getOrder(req("GET", `/api/orders/${o.id}`, { token: b.token }), ctx({ id: o.id }))).status).toBe(404);
    const srv = await db.server.findFirstOrThrow({ where: { userId: a.user.id } });
    expect((await power(req("POST", `/api/servers/${srv.id}/power`, { token: b.token, body: { action: "start" } }), ctx({ id: srv.id }))).status).toBe(404);
    expect((await power(req("POST", `/api/servers/${srv.id}/power`, { body: { action: "start" } }), ctx({ id: srv.id }))).status).toBe(401);
  });
  it("tylko ADMIN zmienia cennik; zmiana trafia do audytu", async () => {
    const { plan } = await seedCatalog();
    const c = await makeUser("CUSTOMER"), s = await makeUser("SUPPORT"), a = await makeUser("ADMIN");
    const call = (token: string) => patchPlan(req("PATCH", `/api/admin/plans/${plan.id}`, { token, body: { priceMonthly: 2500, ramMb: 4096 } }), ctx({ id: plan.id }));
    expect((await call(c.token)).status).toBe(403);
    expect((await call(s.token)).status).toBe(403);
    expect((await call(a.token)).status).toBe(200);
    expect((await db.hostingPlan.findUniqueOrThrow({ where: { id: plan.id } })).priceMonthly).toBe(2500);
    expect(await db.auditLog.count({ where: { action: "admin.plan.updated", actorId: a.user.id } })).toBe(1);
    expect((await patchPlan(req("PATCH", `/api/admin/plans/${plan.id}`, { token: a.token, body: { priceMonthly: -5 } }), ctx({ id: plan.id }))).status).toBe(400);
  });
});

describe("zamówienie i płatność", () => {
  it("cena pochodzi z bazy, a nie od klienta; niedostępny pakiet jest odrzucany", async () => {
    const { plan } = await seedCatalog();
    const u = await makeUser("CUSTOMER");
    const r = await createOrderRoute(req("POST", "/api/orders", { token: u.token, body: { items: [{ planId: plan.id, serverName: "Test", unitPrice: 1 }] } }), none);
    expect((await r.json()).totalAmount).toBe(1900);
    await db.hostingPlan.update({ where: { id: plan.id }, data: { available: false } });
    expect((await createOrderRoute(req("POST", "/api/orders", { token: u.token, body: { items: [{ planId: plan.id, serverName: "Test" }] } }), none)).status).toBe(400);
  });
  it("idempotentny klucz zamówienia nie tworzy duplikatu", async () => {
    const { plan } = await seedCatalog(); const u = await makeUser("CUSTOMER");
    const i = { items: [{ planId: plan.id, serverName: "Test" }], idempotencyKey: "klucz-12345678" };
    const o1 = await createOrder(u.user.id, i), o2 = await createOrder(u.user.id, i);
    expect(o1.id).toBe(o2.id);
  });
  it("płatność DEMO -> subskrypcja + serwer; ponowne potwierdzenie jest idempotentne", async () => {
    const { plan } = await seedCatalog(); const u = await makeUser("CUSTOMER");
    const o = await createOrder(u.user.id, { items: [{ planId: plan.id, serverName: "Serwer 1" }] });
    expect((await payDemo(req("POST", `/api/orders/${o.id}/pay-demo`, { token: u.token }), ctx({ id: o.id }))).status).toBe(200);
    await payDemo(req("POST", `/api/orders/${o.id}/pay-demo`, { token: u.token }), ctx({ id: o.id }));
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("COMPLETED");
    expect(await db.payment.count({ where: { orderId: o.id } })).toBe(1);
    expect(await db.server.count()).toBe(1);
    expect(await db.subscription.count()).toBe(1);
    const srv = await db.server.findFirstOrThrow({ include: { allocation: true } });
    expect(srv.status).toBe("OFFLINE"); expect(srv.isDemo).toBe(true); expect(srv.allocation).not.toBeNull();
  });
  it("cudze zamówienie nie może być opłacone przez innego klienta", async () => {
    const { plan } = await seedCatalog(); const a = await makeUser("CUSTOMER"), b = await makeUser("CUSTOMER");
    const o = await createOrder(a.user.id, { items: [{ planId: plan.id, serverName: "Test" }] });
    expect((await payDemo(req("POST", `/api/orders/${o.id}/pay-demo`, { token: b.token }), ctx({ id: o.id }))).status).toBe(404);
  });
});

describe("webhook płatności", () => {
  const sign = (body: string, secret = "whsec_test_secret", t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
  it("weryfikuje podpis, kwotę i ignoruje duplikaty", async () => {
    const { plan } = await seedCatalog(); const u = await makeUser("CUSTOMER");
    const o = await createOrder(u.user.id, { items: [{ planId: plan.id, serverName: "WH" }] });
    const body = JSON.stringify({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1", client_reference_id: o.id, amount_total: 1900 } } });
    expect((await webhook(req("POST", "/api/webhooks/payments", { raw: body, headers: { "stripe-signature": "t=1,v1=00" } }), none)).status).toBe(400);
    expect((await webhook(req("POST", "/api/webhooks/payments", { raw: body, headers: { "stripe-signature": sign(body, "zly-sekret") } }), none)).status).toBe(400);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PENDING_PAYMENT");
    expect((await webhook(req("POST", "/api/webhooks/payments", { raw: body, headers: { "stripe-signature": sign(body) } }), none)).status).toBe(200);
    expect((await webhook(req("POST", "/api/webhooks/payments", { raw: body, headers: { "stripe-signature": sign(body) } }), none)).status).toBe(200);
    expect(await db.payment.count({ where: { orderId: o.id } })).toBe(1);
    expect(await db.server.count()).toBe(1);
  });
  it("odrzuca złą kwotę i stary znacznik czasu", async () => {
    const { plan } = await seedCatalog(); const u = await makeUser("CUSTOMER");
    const o = await createOrder(u.user.id, { items: [{ planId: plan.id, serverName: "WH" }] });
    const body = JSON.stringify({ id: "evt_2", type: "checkout.session.completed", data: { object: { id: "cs_2", client_reference_id: o.id, amount_total: 1 } } });
    expect((await webhook(req("POST", "/api/webhooks/payments", { raw: body, headers: { "stripe-signature": sign(body) } }), none)).status).toBe(409);
    expect(verifyWebhookSignature("x", sign("x", "whsec_test_secret", 1000), "whsec_test_secret")).toBe(false);
  });
});

describe("provisioning", () => {
  it("brak zasobów: zadanie czeka, a po dodaniu węzła zostaje wykonane", async () => {
    const { plan, node } = await seedCatalog({ allocations: 0 }); const u = await makeUser("CUSTOMER"); await makeUser("ADMIN");
    const o = await paidOrder(u.user.id, plan.id);
    const job = await db.provisioningJob.findFirstOrThrow();
    expect(job.status).toBe("WAITING_RESOURCES");
    expect(await db.server.count()).toBe(0);
    expect(await db.notification.count({ where: { type: "capacity" } })).toBe(1);
    await db.allocation.create({ data: { nodeId: node.id, ip: "203.0.113.1", port: 30000 } });
    await db.provisioningJob.update({ where: { id: job.id }, data: { runAfter: new Date(Date.now() - 1000) } });
    await runDueJobs();
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("COMPLETED");
  });
  it("awaria integracji: ponowne próby z backoffem, potem FAILED i powiadomienie", async () => {
    const { plan } = await seedCatalog(); const u = await makeUser("CUSTOMER"); await makeUser("ADMIN");
    let calls = 0;
    setAdapterForTests({ ...new DemoAdapter(), name: "bad", isDemo: true, createServer: async () => { calls++; throw new ProvisioningError("panel nie odpowiada", true); }, power: async () => "OFFLINE", suspend: async () => {}, deleteServer: async () => {} });
    const o = await paidOrder(u.user.id, plan.id);
    const jobId = (await db.provisioningJob.findFirstOrThrow()).id;
    expect((await db.provisioningJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe("QUEUED");
    for (let i = 0; i < 4; i++) { await db.provisioningJob.update({ where: { id: jobId }, data: { runAfter: new Date(0) } }); await processJob(jobId); }
    const j = await db.provisioningJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(j.status).toBe("FAILED"); expect(j.attempts).toBe(5); expect(calls).toBe(5);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("FAILED");
    expect((await db.server.findFirstOrThrow()).status).toBe("ERROR");
    expect(await db.notification.count({ where: { type: "provisioning_failed" } })).toBeGreaterThanOrEqual(2);
  });
  it("błąd po wcześniejszej awarii: ponowna próba nie duplikuje serwera ani alokacji", async () => {
    const { plan } = await seedCatalog(); const u = await makeUser("CUSTOMER");
    let fail = true;
    setAdapterForTests({ ...new DemoAdapter(), name: "flaky", isDemo: true, createServer: async (i) => { if (fail) { fail = false; throw new ProvisioningError("chwilowo", true); } return { externalId: i.idempotencyKey, externalUuid: "u" }; }, power: async () => "OFFLINE", suspend: async () => {}, deleteServer: async () => {} });
    await paidOrder(u.user.id, plan.id);
    const jobId = (await db.provisioningJob.findFirstOrThrow()).id;
    await db.provisioningJob.update({ where: { id: jobId }, data: { runAfter: new Date(0) } });
    await runDueJobs();
    expect(await db.server.count()).toBe(1);
    expect(await db.allocation.count({ where: { serverId: { not: null } } })).toBe(1);
    expect((await db.server.findFirstOrThrow()).status).toBe("OFFLINE");
  });
});

describe("sterowanie serwerem", () => {
  it("start / restart / stop zmieniają status i są audytowane", async () => {
    const { plan } = await seedCatalog(); const u = await makeUser("CUSTOMER");
    await paidOrder(u.user.id, plan.id);
    const s = await db.server.findFirstOrThrow();
    const act = async (action: string) => (await power(req("POST", `/api/servers/${s.id}/power`, { token: u.token, body: { action } }), ctx({ id: s.id })));
    expect((await act("start")).status).toBe(200);
    expect((await db.server.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("RUNNING");
    await act("restart");
    expect((await db.server.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("RUNNING");
    await act("stop");
    expect((await db.server.findUniqueOrThrow({ where: { id: s.id } })).status).toBe("OFFLINE");
    expect((await act("format-c")).status).toBe(400);
    expect(await db.auditLog.count({ where: { action: { startsWith: "server." } } })).toBe(3);
  });
  it("wygasła subskrypcja blokuje sterowanie", async () => {
    const { plan } = await seedCatalog(); const u = await makeUser("CUSTOMER");
    await paidOrder(u.user.id, plan.id);
    await db.subscription.updateMany({ data: { status: "EXPIRED" } });
    const s = await db.server.findFirstOrThrow();
    expect((await power(req("POST", `/api/servers/${s.id}/power`, { token: u.token, body: { action: "start" } }), ctx({ id: s.id }))).status).toBe(402);
  });
});

describe("zadania wewnętrzne", () => {
  it("run-jobs wymaga sekretu", async () => {
    expect((await runJobs(req("POST", "/api/internal/run-jobs"), none)).status).toBe(401);
    expect((await runJobs(req("POST", "/api/internal/run-jobs", { headers: { "x-cron-secret": "test-cron-secret-0123456789abcdef" } }), none)).status).toBe(200);
  });
});
