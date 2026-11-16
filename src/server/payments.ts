import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { notify } from "./notifications";
import { runDueJobs } from "./provisioning/service";
import type { PaymentProvider } from "@prisma/client";

/**
 * Potwierdzenie płatności -> utworzenie subskrypcji i zadań provisioningowych.
 * Idempotentne: ponowne wywołanie z tym samym zdarzeniem/zamówieniem nic nie zmienia.
 */
export async function settlePayment(args: { orderId: string; provider: PaymentProvider; providerRef: string; eventId: string; amount?: number }) {
  const result = await db.$transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: args.orderId }, include: { items: true } });
    if (!order) throw new ApiError(404, "NOT_FOUND", "Zamówienie nie istnieje");
    if (args.amount !== undefined && args.amount !== order.totalAmount) throw new ApiError(409, "AMOUNT_MISMATCH", "Kwota płatności nie zgadza się z zamówieniem");
    if (await tx.payment.findUnique({ where: { providerEventId: args.eventId } })) return { order, duplicate: true };
    if (order.status !== "PENDING_PAYMENT") return { order, duplicate: true };
    await tx.payment.create({ data: { orderId: order.id, provider: args.provider, status: "SUCCEEDED", amount: order.totalAmount, currency: order.currency, providerRef: args.providerRef, providerEventId: args.eventId } });
    await tx.order.update({ where: { id: order.id }, data: { status: "PROVISIONING" } });
    const end = new Date(); end.setMonth(end.getMonth() + 1);
    for (const it of order.items) {
      await tx.subscription.create({ data: { userId: order.userId, planId: it.planId, orderItemId: it.id, currentPeriodEnd: end } });
      await tx.provisioningJob.create({ data: { orderItemId: it.id } });
    }
    return { order, duplicate: false };
  });
  if (!result.duplicate) {
    await audit(result.order.userId, "payment.succeeded", "Order", result.order.id, { provider: args.provider, ref: args.providerRef });
    await notify(result.order.userId, "payment_ok", "Płatność przyjęta", `Zamówienie ${result.order.number} zostało opłacone. Tworzymy serwer.`);
    await runDueJobs(); // w produkcji robi to także worker
  }
  return { duplicate: result.duplicate };
}

/** Płatność DEMO — działa wyłącznie przy DEMO_MODE=true. Nie pobiera żadnych pieniędzy. */
export async function confirmDemoPayment(userId: string, orderId: string) {
  if (!env.demoMode) throw new ApiError(403, "DEMO_DISABLED", "Płatności demo są wyłączone");
  const order = await db.order.findFirst({ where: { id: orderId, userId } });
  if (!order) throw new ApiError(404, "NOT_FOUND", "Nie znaleziono zamówienia");
  return settlePayment({ orderId, provider: "DEMO", providerRef: `demo_${order.id}`, eventId: `demo_evt_${order.id}` });
}

/** Weryfikacja podpisu webhooka w formacie Stripe: nagłówek `t=<ts>,v1=<hmac_sha256(secret, "<ts>.<body>")>`. */
export function verifyWebhookSignature(rawBody: string, header: string | null, secret: string, toleranceSec = 300, now = Date.now()) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > toleranceSec || !parts.v1) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest();
  const given = Buffer.from(parts.v1, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function handlePaymentWebhook(rawBody: string, signature: string | null) {
  if (!env.stripeWebhookSecret) throw new ApiError(503, "PAYMENTS_DISABLED", "Płatności zewnętrzne nie są skonfigurowane");
  if (!verifyWebhookSignature(rawBody, signature, env.stripeWebhookSecret)) throw new ApiError(400, "BAD_SIGNATURE", "Nieprawidłowy podpis");
  const ev = JSON.parse(rawBody) as { id: string; type: string; data: { object: { id: string; client_reference_id?: string; amount_total?: number } } };
  if (ev.type !== "checkout.session.completed") return { ignored: true };
  const o = ev.data.object;
  if (!o.client_reference_id) throw new ApiError(400, "NO_REFERENCE", "Brak identyfikatora zamówienia");
  return settlePayment({ orderId: o.client_reference_id, provider: "STRIPE", providerRef: o.id, eventId: ev.id, amount: o.amount_total });
}
