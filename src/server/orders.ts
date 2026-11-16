import { randomInt } from "crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ApiError, notFound } from "@/lib/errors";
import { notify } from "./notifications";

/** Zmienne egga ustawiane przez klienta (np. SRCDS_TOKEN = GSLT dla CS2). Adapter przepuści tylko te, które egg oznacza jako user_editable. */
export const envVarsSchema = z.record(z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/, "Niepoprawna nazwa zmiennej"), z.string().trim().max(256))
  .refine((v) => Object.keys(v).length <= 10, "Maksymalnie 10 zmiennych");

export const createOrderSchema = z.object({
  items: z.array(z.object({ planId: z.string().min(1), serverName: z.string().trim().min(3).max(40).regex(/^[\p{L}\p{N} ._-]+$/u, "Niedozwolone znaki"), envVars: envVarsSchema.optional() })).min(1).max(5),
  idempotencyKey: z.string().min(8).max(64).optional(),
});

const orderNumber = () => `GC-${new Date().getFullYear()}-${randomInt(100000, 999999)}`;

/** Cena i parametry zawsze z bazy — nigdy z danych klienta. */
export async function createOrder(userId: string, input: z.infer<typeof createOrderSchema>) {
  if (input.idempotencyKey) {
    const existing = await db.order.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } }, include: { items: true } });
    if (existing) return existing;
  }
  const plans = await db.hostingPlan.findMany({ where: { id: { in: input.items.map((i) => i.planId) } }, include: { game: true } });
  const byId = new Map(plans.map((p) => [p.id, p]));
  for (const it of input.items) {
    const p = byId.get(it.planId);
    if (!p || !p.available || !p.game.enabled) throw new ApiError(400, "PLAN_UNAVAILABLE", "Wybrany pakiet jest niedostępny");
  }
  const items = input.items.map((it) => { const p = byId.get(it.planId)!; return { planId: p.id, planName: `${p.game.name} ${p.name}`, serverName: it.serverName, unitPrice: p.priceMonthly, config: it.envVars && Object.keys(it.envVars).length ? { envVars: it.envVars } : {} }; });
  const order = await db.order.create({
    data: { number: orderNumber(), userId, totalAmount: items.reduce((s, i) => s + i.unitPrice, 0), idempotencyKey: input.idempotencyKey, items: { create: items } },
    include: { items: true },
  });
  await audit(userId, "order.created", "Order", order.id, { number: order.number, total: order.totalAmount });
  return order;
}

/** Zamówienie widoczne tylko dla właściciela (ochrona IDOR) — personel ma wgląd do wszystkich. */
export async function getOrderFor(user: { id: string; role: string }, orderId: string) {
  const order = await db.order.findUnique({ where: { id: orderId }, include: { items: true, payments: { orderBy: { createdAt: "desc" } } } });
  if (!order || (user.role === "CUSTOMER" && order.userId !== user.id)) throw notFound();
  return order;
}

export async function cancelOrder(user: { id: string }, orderId: string) {
  const r = await db.order.updateMany({ where: { id: orderId, userId: user.id, status: "PENDING_PAYMENT" }, data: { status: "CANCELLED" } });
  if (r.count === 0) throw notFound();
  await audit(user.id, "order.cancelled", "Order", orderId);
}

export { notify };
