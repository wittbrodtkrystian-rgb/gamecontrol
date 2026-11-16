import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb, seedCatalog, makeUser } from "./helpers";
import { createOrder } from "@/server/orders";
import { settlePayment } from "@/server/payments";
import { engineDefs, versionSchema } from "@/server/engines";
import { setAdapterForTests } from "@/server/provisioning";
import type { CreateServerInput, GameServerAdapter } from "@/server/provisioning/adapter";

const engineEggs = [{ key: "paper", label: "Paper", nestId: 1, eggId: 3, versionVar: "MINECRAFT_VERSION" }, { key: "vanilla", label: "Vanilla", nestId: 1, eggId: 5, versionVar: "VANILLA_VERSION" }];
let captured: CreateServerInput | null = null;
const spy: GameServerAdapter = {
  name: "spy", isDemo: true,
  async createServer(i) { captured = i; return { externalId: "x-" + i.idempotencyKey, externalUuid: "u-" + i.idempotencyKey }; },
  async power() { return "STARTING"; }, async suspend() {}, async deleteServer() {},
};
beforeEach(async () => { await resetDb(); captured = null; setAdapterForTests(spy); });

async function setup() {
  const { game, plan } = await seedCatalog({ allocations: 3 });
  await db.game.update({ where: { id: game.id }, data: { features: { engineEggs } } });
  await db.hostingPlan.update({ where: { id: plan.id }, data: { pterodactylNestId: 1, pterodactylEggId: 3 } });
  return { plan, user: (await makeUser("CUSTOMER")).user };
}
async function pay(orderId: string) { await settlePayment({ orderId, provider: "DEMO", providerRef: "r-" + orderId, eventId: "e-" + orderId }); }

describe("wybór silnika i wersji", () => {
  it("parsuje definicje silników i waliduje wersję", () => {
    expect(engineDefs({ engineEggs })).toHaveLength(2); expect(engineDefs(null)).toEqual([]); expect(engineDefs({ engineEggs: [{ key: 1 }] })).toEqual([]);
    for (const ok of ["latest", "1.21.4", "1.8"]) expect(versionSchema.safeParse(ok).success).toBe(true);
    for (const bad of ["1.21.4; rm -rf /", "$(id)", "x", "", "1.2.3.4"]) expect(versionSchema.safeParse(bad).success).toBe(false);
  });
  it("odrzuca nieznany silnik", async () => {
    const { plan, user } = await setup();
    await expect(createOrder(user.id, { items: [{ planId: plan.id, serverName: "Serwer", engine: "magma" }] })).rejects.toMatchObject({ code: "BAD_ENGINE" });
  });
  it("silnik i wersja z zamówienia wybierają egg i zmienną wersji; domyślnie pierwszy silnik i latest", async () => {
    const { plan, user } = await setup();
    const o = await createOrder(user.id, { items: [{ planId: plan.id, serverName: "Vanilla 1", engine: "vanilla", version: "1.21.4" }] });
    await pay(o.id);
    expect(captured).toMatchObject({ nestId: 1, eggId: 5, envVars: { VANILLA_VERSION: "1.21.4" } });
    const o2 = await createOrder(user.id, { items: [{ planId: plan.id, serverName: "Domyslny" }] });
    await pay(o2.id);
    expect(captured).toMatchObject({ nestId: 1, eggId: 3, envVars: { MINECRAFT_VERSION: "latest" } });
  });
  it("klient nie nadpisze wersji przez własne envVars", async () => {
    const { plan, user } = await setup();
    const o = await createOrder(user.id, { items: [{ planId: plan.id, serverName: "Paper 1", engine: "paper", version: "1.20.6", envVars: { MINECRAFT_VERSION: "evil" } }] });
    await pay(o.id);
    expect((captured as CreateServerInput | null)?.envVars?.MINECRAFT_VERSION).toBe("1.20.6");
  });
});
