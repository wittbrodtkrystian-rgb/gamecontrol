import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getAdapter } from "./provisioning";
import { notify } from "./notifications";

/** Powiadomienia o wygasaniu (3 dni) oraz wygaszanie przeterminowanych usług (zawieszenie serwera). */
export async function processSubscriptions(now = new Date()) {
  const soon = await db.subscription.findMany({ where: { status: "ACTIVE", expiryNotifiedAt: null, currentPeriodEnd: { lte: new Date(now.getTime() + 3 * 86400_000), gt: now } }, include: { server: true } });
  for (const s of soon) {
    await notify(s.userId, "expiring", "Usługa wkrótce wygaśnie", `Abonament wygasa ${s.currentPeriodEnd.toLocaleDateString("pl-PL")}. Przedłuż go, aby nie stracić serwera.`);
    await db.subscription.update({ where: { id: s.id }, data: { expiryNotifiedAt: now } });
  }
  const expired = await db.subscription.findMany({ where: { status: "ACTIVE", currentPeriodEnd: { lte: now } }, include: { server: true } });
  for (const s of expired) {
    await db.subscription.update({ where: { id: s.id }, data: { status: "EXPIRED" } });
    if (s.server) { await getAdapter().suspend(s.server, true).catch(() => {}); await db.server.update({ where: { id: s.server.id }, data: { status: "SUSPENDED" } }); }
    await notify(s.userId, "expired", "Usługa wygasła", "Serwer został zawieszony. Przedłuż abonament, aby go przywrócić.");
    await audit(null, "subscription.expired", "Subscription", s.id);
  }
  return { notified: soon.length, expired: expired.length };
}

/** Przedłużenie abonamentu. W trybie produkcyjnym wymaga płatności (Etap 3) — tu tylko DEMO. */
export async function renewDemo(userId: string, subscriptionId: string) {
  const { env } = await import("@/lib/env");
  const { ApiError, notFound } = await import("@/lib/errors");
  if (!env.demoMode) throw new ApiError(501, "NOT_IMPLEMENTED", "Odnawianie wymaga płatności Stripe (Etap 3)");
  const s = await db.subscription.findFirst({ where: { id: subscriptionId, userId }, include: { server: true } });
  if (!s) throw notFound();
  const base = s.currentPeriodEnd > new Date() ? s.currentPeriodEnd : new Date();
  const end = new Date(base); end.setMonth(end.getMonth() + 1);
  await db.subscription.update({ where: { id: s.id }, data: { status: "ACTIVE", currentPeriodEnd: end, expiryNotifiedAt: null } });
  if (s.server?.status === "SUSPENDED") { await getAdapter().suspend(s.server, false); await db.server.update({ where: { id: s.server.id }, data: { status: "OFFLINE" } }); }
  await audit(userId, "subscription.renewed", "Subscription", s.id, { demo: true });
  return { currentPeriodEnd: end };
}
