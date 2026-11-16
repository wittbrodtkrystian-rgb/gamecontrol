import "dotenv/config";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

// ID jajek Minecrafta różnią się między panelami. Domyślnie: Paper 3, Vanilla 5 (świeży panel 1.15 lokalnie).
// Nadpisanie: SEED_MC_EGGS="paper=5,vanilla=1,purpur=15,fabric=16" (silniki w tej kolejności; pierwszy = domyślny dla planów).
const mcEggDefaults: Record<string, { label: string; versionVar: string; eggId: number }> = {
  paper: { label: "Paper", versionVar: "MINECRAFT_VERSION", eggId: 3 }, vanilla: { label: "Vanilla", versionVar: "VANILLA_VERSION", eggId: 5 },
  purpur: { label: "Purpur", versionVar: "MINECRAFT_VERSION", eggId: 0 }, fabric: { label: "Fabric", versionVar: "MC_VERSION", eggId: 0 },
};
const mcEngineEggs = (process.env.SEED_MC_EGGS
  ? process.env.SEED_MC_EGGS.split(",").map((p) => p.trim().split("=")).filter(([k, v]) => k in mcEggDefaults && /^\d+$/.test(v ?? ""))
      .map(([k, v]) => ({ key: k, label: mcEggDefaults[k].label, nestId: 1, eggId: Number(v), versionVar: mcEggDefaults[k].versionVar }))
  : ["paper", "vanilla"].map((k) => ({ key: k, label: mcEggDefaults[k].label, nestId: 1, eggId: mcEggDefaults[k].eggId, versionVar: mcEggDefaults[k].versionVar })));
const mcDefaultEgg = mcEngineEggs[0]?.eggId ?? 3;

const games = [
  { slug: "minecraft", name: "Minecraft Java", sortOrder: 1, description: "Paper, Vanilla i Purpur. Zmiana wersji i pluginy.",
    // engineEggs: silniki wybierane przy zamówieniu = osobne egg-i. ID z domyślnego panelu 1.15 (Paper 3, Vanilla 5 w nest 1); Purpur/Fabric trzeba
    // zaimportować i dopisać ich ID (Admin → Nests). Sprawdź ID w swoim panelu!
    features: { engines: ["Paper", "Vanilla", "Purpur", "Fabric"], plugins: true, versionSwitch: true,
      engineEggs: mcEngineEggs } },
  { slug: "cs2", name: "Counter-Strike 2", sortOrder: 2, description: "Serwery publiczne, Retake, Deathmatch, Arena 1v1 i mapy z Workshopu.",
    features: { modes: ["Publiczny", "Retake", "Deathmatch", "Arena 1v1"], workshopMaps: true, addons: "CounterStrikeSharp/Metamod — ręczna instalacja" } },
  { slug: "rust", name: "Rust", sortOrder: 3, description: "Vanilla i modded (uMod/Oxide), zarządzanie wipe.",
    features: { modes: ["Vanilla", "Modded"], wipe: true, plugins: "uMod/Oxide, jeśli wybrany silnik je obsługuje" } },
  // FiveM: wyłączone domyślnie, dopóki klient nie ma dostępu do plików/txAdmin; wymaga własnego klucza z portal.cfx.re (max 48 slotów w eggu)
  { slug: "fivem", name: "FiveM (GTA RP)", sortOrder: 4, enabled: false, description: "Serwery GTA V Roleplay i Freeroam. Wymagany własny klucz licencyjny Cfx.re.",
    features: { modes: ["Roleplay", "Freeroam"], txAdmin: true, licenseKeyRequired: true, maxSlots: 48 } },
];
// ceny w groszach — TESTOWE
const plans = [
  ["minecraft", "mc-starter", "Starter", 1900, 2048, 100, 10240, 20],
  ["minecraft", "mc-standard", "Standard", 3900, 4096, 200, 20480, 50],
  ["minecraft", "mc-premium", "Premium", 6900, 8192, 300, 40960, 100],
  ["cs2", "cs2-basic", "Basic", 2900, 4096, 200, 76800, 12], // CS2 po instalacji zajmuje ok. 69 GB; przy 50 GB Wings odmawia startu ("not enough disk space")
  ["cs2", "cs2-pro", "Pro", 5900, 8192, 400, 76800, 32],
  ["rust", "rust-survival", "Survival", 9900, 12288, 400, 40960, 100],
  ["fivem", "fivem-start", "Start", 2100, 2048, 100, 15360, 16], // ceny FiveM są propozycją do ustalenia
  ["fivem", "fivem-standard", "Standard", 3900, 4096, 200, 25600, 32],
  ["fivem", "fivem-pro", "Pro", 6900, 6144, 300, 40960, 48],
] as const;

async function main() {
  const adminPw = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
  const demoPw = process.env.SEED_DEMO_PASSWORD || randomBytes(9).toString("base64url");
  for (const g of games) await db.game.upsert({ where: { slug: g.slug }, update: {}, create: g });
  for (const [gs, slug, name, price, ram, cpu, disk, slots] of plans) {
    const game = await db.game.findUniqueOrThrow({ where: { slug: gs } });
    await db.hostingPlan.upsert({ where: { slug }, update: {}, create: { gameId: game.id, slug, name, priceMonthly: price, ramMb: ram, cpuPercent: cpu, diskMb: disk, slots, sortOrder: price, ...(gs === "minecraft" ? { pterodactylNestId: 1, pterodactylEggId: mcDefaultEgg } : gs === "rust" ? { pterodactylNestId: 4, pterodactylEggId: 14 } : {}) } });
  }
  const node = await db.node.upsert({ where: { name: "demo-node-1" }, update: {}, create: { name: "demo-node-1", fqdn: "demo.invalid", location: "DEMO (symulacja)", ramTotalMb: 65536, diskTotalMb: 1_000_000, cpuTotal: 1600, isDemo: true } });
  for (let i = 0; i < 20; i++) await db.allocation.upsert({ where: { nodeId_ip_port: { nodeId: node.id, ip: "203.0.113.10", port: 25565 + i } }, update: {}, create: { nodeId: node.id, ip: "203.0.113.10", port: 25565 + i } });
  const users = [["admin@gamecontrol.local", "Administrator", "ADMIN", adminPw], ["support@gamecontrol.local", "Support", "SUPPORT", demoPw], ["klient@gamecontrol.local", "Klient Demo", "CUSTOMER", demoPw]] as const;
  for (const [email, name, role, pw] of users) {
    const exists = await db.user.findUnique({ where: { email } });
    if (!exists) { await db.user.create({ data: { email, name, role, passwordHash: await bcrypt.hash(pw, 12) } }); 
      const given = role === "ADMIN" ? !!process.env.SEED_ADMIN_PASSWORD : !!process.env.SEED_DEMO_PASSWORD; // hasło podane w .env — nie wypisujemy go
      console.log(`Utworzono ${role}: ${email}${given ? " (hasło z .env)" : " / " + pw}`); }
  }
  console.log("Seed zakończony.");
}
main().finally(() => db.$disconnect());
