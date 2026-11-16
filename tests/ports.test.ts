import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb, seedCatalog, makeUser } from "./helpers";
import { createOrder } from "@/server/orders";
import { settlePayment } from "@/server/payments";
import { preferredPorts } from "@/server/provisioning/service";

beforeEach(resetDb);

describe("przydział portów wg gry", () => {
  it("zakresy domyślnych portów gier", () => {
    expect(preferredPorts("minecraft")).toEqual([25565, 25599]);
    expect(preferredPorts("cs2")).toEqual([27015, 27099]);
    expect(preferredPorts("rust")).toEqual([28015, 28099]);
    expect(preferredPorts("fivem")).toEqual([30120, 30199]);
    expect(preferredPorts("nieznana")).toBeNull();
  });

  async function order(planId: string, name: string) {
    const u = await makeUser("CUSTOMER");
    const o = await createOrder(u.user.id, { items: [{ planId, serverName: name }] });
    await settlePayment({ orderId: o.id, provider: "DEMO", providerRef: `r-${o.id}`, eventId: `e-${o.id}` });
    return db.allocation.findFirstOrThrow({ where: { server: { orderItem: { orderId: o.id } } } });
  }

  it("CS2 dostaje port z zakresu 27015+, a nie pierwszy wolny (25565)", async () => {
    const { node } = await seedCatalog({ allocations: 3 }); // 25565-25567
    for (const p of [27015, 27016]) await db.allocation.create({ data: { nodeId: node.id, ip: "203.0.113.1", port: p } });
    const cs2 = await db.game.create({ data: { slug: "cs2", name: "Counter-Strike 2", description: "t" } });
    const plan = await db.hostingPlan.create({ data: { gameId: cs2.id, slug: "cs2-basic", name: "Basic", priceMonthly: 2900, ramMb: 2048, cpuPercent: 100, diskMb: 10240, slots: 12 } });
    expect((await order(plan.id, "Serwer CS2 1")).port).toBe(27015);
    expect((await order(plan.id, "Serwer CS2 2")).port).toBe(27016);
  });

  it("Minecraft poza DEMO wymaga zaakceptowania EULA", async () => {
    const { plan } = await seedCatalog({ allocations: 1 }); const u = await makeUser("CUSTOMER");
    process.env.DEMO_MODE = "false";
    try {
      await expect(createOrder(u.user.id, { items: [{ planId: plan.id, serverName: "Bez EULA" }] })).rejects.toMatchObject({ status: 400, code: "EULA_REQUIRED" });
      const o = await createOrder(u.user.id, { items: [{ planId: plan.id, serverName: "Z EULA", acceptEula: true }] });
      expect((await db.orderItem.findFirstOrThrow({ where: { orderId: o.id } })).config).toMatchObject({ acceptEula: true });
    } finally { delete process.env.DEMO_MODE; }
  });
  it("FiveM poza DEMO wymaga poprawnego klucza licencyjnego Cfx.re i zapisuje go w zamówieniu", async () => {
    const { game } = await seedCatalog({ allocations: 1 }); const u = await makeUser("CUSTOMER");
    const fv = await db.game.create({ data: { slug: "fivem", name: "FiveM", description: "t" } });
    const plan = await db.hostingPlan.create({ data: { gameId: fv.id, slug: "fivem-start", name: "Start", priceMonthly: 2100, ramMb: 2048, cpuPercent: 100, diskMb: 15360, slots: 16 } });
    void game; process.env.DEMO_MODE = "false";
    try {
      for (const envVars of [undefined, { FIVEM_LICENSE: "krotki" }, { FIVEM_LICENSE: "x".repeat(40) }, { FIVEM_LICENSE: "abc def ghi jkl" }])
        await expect(createOrder(u.user.id, { items: [{ planId: plan.id, serverName: "RP Serwer", envVars }] })).rejects.toMatchObject({ code: "LICENSE_REQUIRED" });
      const o = await createOrder(u.user.id, { items: [{ planId: plan.id, serverName: "RP Serwer", envVars: { FIVEM_LICENSE: "cfxk_abcdefgh_1234" } }] });
      expect((await db.orderItem.findFirstOrThrow({ where: { orderId: o.id } })).config).toMatchObject({ envVars: { FIVEM_LICENSE: "cfxk_abcdefgh_1234" } });
    } finally { delete process.env.DEMO_MODE; }
  });
  it("gdy zakres gry jest zajęty, bierze dowolną wolną alokację (bez błędu)", async () => {
    await seedCatalog({ allocations: 2 }); // tylko 25565-25566
    const cs2 = await db.game.create({ data: { slug: "cs2", name: "Counter-Strike 2", description: "t" } });
    const plan = await db.hostingPlan.create({ data: { gameId: cs2.id, slug: "cs2-basic", name: "Basic", priceMonthly: 2900, ramMb: 2048, cpuPercent: 100, diskMb: 10240, slots: 12 } });
    expect((await order(plan.id, "Serwer CS2 3")).port).toBe(25565);
  });
});
