import "dotenv/config";
import { runDueJobs } from "./provisioning/service";
import { processSubscriptions } from "./subscriptions";

// Prosty worker oparty o bazę danych. Przejście na BullMQ/Redis planowane w Etapie 2 (REDIS_URL).
async function tick() {
  try { const r = await runDueJobs(); if (Object.keys(r).length) console.log("[worker] jobs", r); await processSubscriptions(); }
  catch (e) { console.error("[worker]", e); }
}
console.log("[worker] start");
void tick();
setInterval(tick, 15_000);
