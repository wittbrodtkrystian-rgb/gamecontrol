import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify, notifyStaff } from "../notifications";
import { getAdapter } from "./index";
import { ProvisioningError } from "./adapter";

const BACKOFF_MIN = [1, 5, 15, 60, 180];

/** Domyślne porty gier: Minecraft 25565, CS2 27015, Rust 28015 (zakresy, z których wybieramy wolną alokację w pierwszej kolejności). */
const PREFERRED_PORTS: [string, [number, number]][] = [["minecraft", [25565, 25599]], ["cs2", [27015, 27099]], ["rust", [28015, 28099]]];
export const preferredPorts = (slug: string) => PREFERRED_PORTS.find(([k]) => slug.toLowerCase().includes(k))?.[1] ?? null;

/** Wybiera węzeł z wolnym RAM/dyskiem/CPU i wolną alokacją; zwraca null, gdy brak zasobów. */
export async function pickNode(need: { ramMb: number; diskMb: number; cpuPercent: number }, demoOnly: boolean) {
  const nodes = await db.node.findMany({ where: { enabled: true, maintenance: false, ...(demoOnly ? { isDemo: true } : { isDemo: false }) }, orderBy: { name: "asc" } });
  let best: { id: string; free: number } | null = null;
  for (const n of nodes) {
    const used = await db.server.aggregate({ where: { nodeId: n.id, status: { not: "ERROR" } }, _sum: { ramMb: true, diskMb: true, cpuPercent: true } });
    const freeRam = n.ramTotalMb - (used._sum.ramMb ?? 0);
    if (freeRam < need.ramMb || n.diskTotalMb - (used._sum.diskMb ?? 0) < need.diskMb || n.cpuTotal - (used._sum.cpuPercent ?? 0) < need.cpuPercent) continue;
    if (!(await db.allocation.count({ where: { nodeId: n.id, serverId: null } }))) continue;
    if (!best || freeRam > best.free) best = { id: n.id, free: freeRam };
  }
  return best?.id ?? null;
}

/** Przetwarza jedno zadanie provisioningowe. Idempotentne i bezpieczne przy równoległych wywołaniach. */
export async function processJob(jobId: string): Promise<string> {
  const claimed = await db.provisioningJob.updateMany({
    where: { id: jobId, status: { in: ["QUEUED", "WAITING_RESOURCES"] }, runAfter: { lte: new Date() } },
    data: { status: "RUNNING", lockedAt: new Date() },
  });
  if (claimed.count === 0) return "skipped";
  const job = await db.provisioningJob.findUniqueOrThrow({ where: { id: jobId }, include: { orderItem: { include: { plan: { include: { game: true } }, order: { include: { user: true } }, server: true } } } });
  const item = job.orderItem, order = item.order, plan = item.plan, adapter = getAdapter();
  try {
    // Idempotencja: serwer już w pełni utworzony
    if (item.server?.externalId && item.server.status !== "PENDING") {
      await db.provisioningJob.update({ where: { id: jobId }, data: { status: "SUCCEEDED" } });
      return "already-done";
    }
    const nodeId = item.server?.nodeId ?? await pickNode(plan, adapter.isDemo);
    if (!nodeId) {
      await db.provisioningJob.update({ where: { id: jobId }, data: { status: "WAITING_RESOURCES", lastError: "Brak wolnych zasobów na węzłach", runAfter: new Date(Date.now() + 5 * 60_000) } });
      await notifyStaff("capacity", "Brak zasobów", `Zamówienie ${order.number} czeka na wolny węzeł.`);
      return "waiting-resources";
    }
    const node = await db.node.findUniqueOrThrow({ where: { id: nodeId } });
    // Rezerwacja serwera + alokacji w jednej transakcji (unikalność Allocation.serverId chroni przed wyścigiem)
    const server = item.server ?? await db.$transaction(async (tx) => {
      // Preferowany zakres portów gry (np. CS2 = 27015+); gdy zajęty, bierzemy dowolną wolną alokację węzła.
      const range = preferredPorts(plan.game.slug);
      const alloc = (range && await tx.allocation.findFirst({ where: { nodeId, serverId: null, port: { gte: range[0], lte: range[1] } }, orderBy: { port: "asc" } }))
        || await tx.allocation.findFirst({ where: { nodeId, serverId: null }, orderBy: { port: "asc" } });
      if (!alloc) throw new ProvisioningError("Brak wolnej alokacji", true);
      const sub = await tx.subscription.findUnique({ where: { orderItemId: item.id } });
      const s = await tx.server.create({ data: {
        userId: order.userId, planId: plan.id, orderItemId: item.id, subscriptionId: sub?.id, nodeId, name: item.serverName,
        status: "INSTALLING", ramMb: plan.ramMb, cpuPercent: plan.cpuPercent, diskMb: plan.diskMb, slots: plan.slots, isDemo: adapter.isDemo,
      } });
      const claim = await tx.allocation.updateMany({ where: { id: alloc.id, serverId: null }, data: { serverId: s.id } });
      if (claim.count === 0) throw new ProvisioningError("Alokacja zajęta, ponowna próba", true);
      return s;
    });
    const alloc = await db.allocation.findUniqueOrThrow({ where: { serverId: server.id } });
    const ext = await adapter.createServer({
      name: item.serverName, ownerEmail: order.user.email, ownerName: order.user.name, gameSlug: plan.game.slug, ramMb: plan.ramMb, cpuPercent: plan.cpuPercent, diskMb: plan.diskMb,
      node: { id: node.id, pterodactylNodeId: node.pterodactylNodeId }, allocation: { ip: alloc.ip, port: alloc.port, externalId: alloc.pterodactylId }, nestId: plan.pterodactylNestId,
      eggId: plan.pterodactylEggId, dockerImage: plan.dockerImage, idempotencyKey: item.id,
      envVars: (item.config as { envVars?: Record<string, string> } | null)?.envVars,
    });
    await db.$transaction([
      db.server.update({ where: { id: server.id }, data: { status: "OFFLINE", externalId: ext.externalId, externalUuid: ext.externalUuid } }),
      db.provisioningJob.update({ where: { id: jobId }, data: { status: "SUCCEEDED", lastError: null } }),
    ]);
    await finalizeOrder(order.id);
    await notify(order.userId, "server_ready", "Serwer gotowy", `Serwer „${item.serverName}” został utworzony.`);
    await audit(null, "provisioning.succeeded", "Server", server.id, { orderItemId: item.id, adapter: adapter.name });
    return "succeeded";
  } catch (e) {
    const err = e instanceof ProvisioningError ? e : new ProvisioningError((e as Error).message, true);
    const attempts = job.attempts + 1;
    const final = !err.retryable || attempts >= job.maxAttempts;
    await db.provisioningJob.update({ where: { id: jobId }, data: {
      status: final ? "FAILED" : "QUEUED", attempts, lastError: err.message.slice(0, 500),
      runAfter: new Date(Date.now() + BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] * 60_000),
    } });
    if (final) {
      await db.server.updateMany({ where: { orderItemId: item.id, externalId: null }, data: { status: "ERROR" } });
      await db.order.update({ where: { id: order.id }, data: { status: "FAILED" } });
      await notifyStaff("provisioning_failed", "Błąd provisioningu", `Zamówienie ${order.number}: ${err.message}`);
      await notify(order.userId, "provisioning_failed", "Problem z utworzeniem serwera", "Nasz zespół został powiadomiony i zajmie się zamówieniem.");
    }
    return final ? "failed" : "retry-scheduled";
  }
}

async function finalizeOrder(orderId: string) {
  const open = await db.provisioningJob.count({ where: { orderItem: { orderId }, status: { not: "SUCCEEDED" } } });
  if (open === 0) await db.order.updateMany({ where: { id: orderId, status: "PROVISIONING" }, data: { status: "COMPLETED" } });
}

/** Przetwarza wszystkie zadania gotowe do uruchomienia. Wywoływane po płatności, przez worker i cron. */
export async function runDueJobs(limit = 20) {
  // Odzyskiwanie zadań zawieszonych po awarii procesu (blokada starsza niż 10 min)
  await db.provisioningJob.updateMany({ where: { status: "RUNNING", lockedAt: { lt: new Date(Date.now() - 10 * 60_000) } }, data: { status: "QUEUED" } });
  const jobs = await db.provisioningJob.findMany({ where: { status: { in: ["QUEUED", "WAITING_RESOURCES"] }, runAfter: { lte: new Date() } }, orderBy: { createdAt: "asc" }, take: limit, select: { id: true } });
  const results: Record<string, string> = {};
  for (const j of jobs) results[j.id] = await processJob(j.id);
  return results;
}
