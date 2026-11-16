import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, createSession, SESSION_COOKIE } from "@/lib/auth";
import { _resetRateLimits } from "@/lib/rate-limit";

export async function resetDb() {
  _resetRateLimits();
  await db.$executeRawUnsafe(`TRUNCATE "AuditLog","ProvisioningJob","Backup","ServerMetric","Allocation","Server","Subscription","Payment","OrderItem","Order","Notification","SupportTicket","Session","HostingPlan","Game","Node","User" RESTART IDENTITY CASCADE`);
}
export async function seedCatalog(opts: { allocations?: number } = {}) {
  const game = await db.game.create({ data: { slug: "minecraft", name: "Minecraft Java", description: "t" } });
  const plan = await db.hostingPlan.create({ data: { gameId: game.id, slug: "mc-starter", name: "Starter", priceMonthly: 1900, ramMb: 2048, cpuPercent: 100, diskMb: 10240, slots: 20 } });
  const node = await db.node.create({ data: { name: "n1", fqdn: "x.invalid", location: "t", ramTotalMb: 8192, diskTotalMb: 100000, cpuTotal: 400, isDemo: true } });
  for (let i = 0; i < (opts.allocations ?? 5); i++) await db.allocation.create({ data: { nodeId: node.id, ip: "203.0.113.1", port: 25565 + i } });
  return { game, plan, node };
}
export async function makeUser(role: "ADMIN" | "SUPPORT" | "CUSTOMER", email = `${role.toLowerCase()}-${Math.random().toString(36).slice(2, 7)}@t.pl`) {
  const user = await db.user.create({ data: { email, name: email, role, passwordHash: await hashPassword("password-12345") } });
  const { token } = await createSession(user.id);
  return { user, token };
}
export function req(method: string, url: string, opts: { token?: string; body?: unknown; headers?: Record<string, string>; raw?: string } = {}) {
  const headers: Record<string, string> = { host: "localhost:3000", "content-type": "application/json", ...opts.headers };
  if (opts.token) headers.cookie = `${SESSION_COOKIE}=${opts.token}`;
  return new NextRequest(`http://localhost:3000${url}`, { method, headers, body: opts.raw ?? (opts.body ? JSON.stringify(opts.body) : undefined) });
}
export const ctx = <P>(params: P) => ({ params: Promise.resolve(params) });
