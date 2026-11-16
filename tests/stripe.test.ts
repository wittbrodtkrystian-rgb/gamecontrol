import http from "http";
import type { AddressInfo } from "net";
import { createHmac } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb, seedCatalog, makeUser, req, ctx } from "./helpers";
import { POST as checkout } from "@/app/api/orders/[id]/checkout/route";
import { POST as webhook } from "@/app/api/webhooks/payments/route";
import { createOrder } from "@/server/orders";

// MOCK API Stripe — sprawdza nasze żądania, nie prawdziwy Stripe.
let srv: http.Server; let last: { auth?: string; form?: URLSearchParams; idem?: string } = {};
beforeAll(async () => {
  srv = http.createServer((rq, rs) => { let raw = ""; rq.on("data", (c) => (raw += c)); rq.on("end", () => {
    last = { auth: rq.headers.authorization, form: new URLSearchParams(raw), idem: rq.headers["idempotency-key"] as string };
    rs.writeHead(200, { "content-type": "application/json" }); rs.end(JSON.stringify({ id: "cs_test_1", url: "https://checkout.stripe.test/pay/cs_test_1" })); }); });
  await new Promise<void>((r) => srv.listen(0, r));
  process.env.STRIPE_API_BASE = `http://127.0.0.1:${(srv.address() as AddressInfo).port}`;
});
afterAll(() => { srv.close(); process.env.DEMO_MODE = "true"; delete process.env.STRIPE_SECRET_KEY; });
beforeEach(async () => { await resetDb(); process.env.DEMO_MODE = "false"; process.env.STRIPE_SECRET_KEY = "sk_test_x"; });

describe("Stripe Checkout (mock API)", () => {
  it("tworzy sesję z kwotą z bazy, a webhook opłaca zamówienie bez duplikatu płatności", async () => {
    const { plan } = await seedCatalog(); const u = await makeUser("CUSTOMER"), other = await makeUser("CUSTOMER");
    const o = await createOrder(u.user.id, { items: [{ planId: plan.id, serverName: "Stripe" }] });
    expect((await checkout(req("POST", `/api/orders/${o.id}/checkout`, { token: other.token }), ctx({ id: o.id }))).status).toBe(404);
    const r = await checkout(req("POST", `/api/orders/${o.id}/checkout`, { token: u.token }), ctx({ id: o.id }));
    expect((await r.json()).url).toContain("checkout.stripe.test");
    expect(last.auth).toBe("Bearer sk_test_x"); expect(last.idem).toBe(`checkout-${o.id}`);
    expect(last.form!.get("line_items[0][price_data][unit_amount]")).toBe("1900"); expect(last.form!.get("client_reference_id")).toBe(o.id);
    const body = JSON.stringify({ id: "evt_s1", type: "checkout.session.completed", data: { object: { id: "cs_test_1", client_reference_id: o.id, amount_total: 1900 } } });
    const t = Math.floor(Date.now() / 1000), sig = `t=${t},v1=${createHmac("sha256", "whsec_test_secret").update(`${t}.${body}`).digest("hex")}`;
    expect((await webhook(req("POST", "/api/webhooks/payments", { raw: body, headers: { "stripe-signature": sig } }), ctx({}))).status).toBe(200);
    expect(await db.payment.count({ where: { orderId: o.id } })).toBe(1);
    expect((await db.payment.findFirstOrThrow({ where: { orderId: o.id } })).status).toBe("SUCCEEDED");
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PROVISIONING");
  });
  it("tryb DEMO blokuje Stripe, brak klucza = 503", async () => {
    const { plan } = await seedCatalog(); const u = await makeUser("CUSTOMER");
    const o = await createOrder(u.user.id, { items: [{ planId: plan.id, serverName: "S" }] });
    delete process.env.STRIPE_SECRET_KEY;
    expect((await checkout(req("POST", `/api/orders/${o.id}/checkout`, { token: u.token }), ctx({ id: o.id }))).status).toBe(503);
    process.env.DEMO_MODE = "true"; process.env.STRIPE_SECRET_KEY = "sk_test_x";
    expect((await checkout(req("POST", `/api/orders/${o.id}/checkout`, { token: u.token }), ctx({ id: o.id }))).status).toBe(400);
  });
});
