import "dotenv/config";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

const games = [
  { slug: "minecraft", name: "Minecraft Java", sortOrder: 1, description: "Paper, Vanilla i Purpur. Zmiana wersji i pluginy.",
    features: { engines: ["Paper", "Vanilla", "Purpur"], plugins: true, versionSwitch: true } },
  { slug: "cs2", name: "Counter-Strike 2", sortOrder: 2, description: "Serwery publiczne, Retake, Deathmatch, Arena 1v1 i mapy z Workshopu.",
    features: { modes: ["Publiczny", "Retake", "Deathmatch", "Arena 1v1"], workshopMaps: true, addons: "CounterStrikeSharp/Metamod — ręczna instalacja" } },
  { slug: "rust", name: "Rust", sortOrder: 3, description: "Vanilla i modded (uMod/Oxide), zarządzanie wipe.",
    features: { modes: ["Vanilla", "Modded"], wipe: true, plugins: "uMod/Oxide, jeśli wybrany silnik je obsługuje" } },
];
// ceny w groszach — TESTOWE
const plans = [
  ["minecraft", "mc-starter", "Starter", 1900, 2048, 100, 10240, 20],
  ["minecraft", "mc-standard", "Standard", 3900, 4096, 200, 20480, 50],
  ["minecraft", "mc-premium", "Premium", 6900, 8192, 300, 40960, 100],
  ["cs2", "cs2-basic", "Basic", 2900, 4096, 200, 51200, 12],
  ["cs2", "cs2-pro", "Pro", 5900, 8192, 400, 76800, 32],
  ["rust", "rust-survival", "Survival", 9900, 12288, 400, 40960, 100],
] as const;

async function main() {
  const adminPw = process.env.SEED_ADMIN_PASSWORD || randomBytes(9).toString("base64url");
  const demoPw = process.env.SEED_DEMO_PASSWORD || randomBytes(9).toString("base64url");
  for (const g of games) await db.game.upsert({ where: { slug: g.slug }, update: {}, create: g });
  for (const [gs, slug, name, price, ram, cpu, disk, slots] of plans) {
    const game = await db.game.findUniqueOrThrow({ where: { slug: gs } });
    await db.hostingPlan.upsert({ where: { slug }, update: {}, create: { gameId: game.id, slug, name, priceMonthly: price, ramMb: ram, cpuPercent: cpu, diskMb: disk, slots, sortOrder: price, ...(gs === "minecraft" ? { pterodactylNestId: 1, pterodactylEggId: 5 } : gs === "rust" ? { pterodactylNestId: 4, pterodactylEggId: 14 } : {}) } });
  }
  const node = await db.node.upsert({ where: { name: "demo-node-1" }, update: {}, create: { name: "demo-node-1", fqdn: "demo.invalid", location: "DEMO (symulacja)", ramTotalMb: 65536, diskTotalMb: 1_000_000, cpuTotal: 1600, isDemo: true } });
  for (let i = 0; i < 20; i++) await db.allocation.upsert({ where: { nodeId_ip_port: { nodeId: node.id, ip: "203.0.113.10", port: 25565 + i } }, update: {}, create: { nodeId: node.id, ip: "203.0.113.10", port: 25565 + i } });
  const users = [["admin@gamecontrol.local", "Administrator", "ADMIN", adminPw], ["support@gamecontrol.local", "Support", "SUPPORT", demoPw], ["klient@gamecontrol.local", "Klient Demo", "CUSTOMER", demoPw]] as const;
  for (const [email, name, role, pw] of users) {
    const exists = await db.user.findUnique({ where: { email } });
    if (!exists) { await db.user.create({ data: { email, name, role, passwordHash: await bcrypt.hash(pw, 12) } }); console.log(`Utworzono ${role}: ${email} / ${pw}`); }
  }
  console.log("Seed zakończony.");
}
main().finally(() => db.$disconnect());
