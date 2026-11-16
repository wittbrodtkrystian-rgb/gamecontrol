import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ApiError } from "@/lib/errors";
import { getAdapter } from "./provisioning";
import { ProvisioningError } from "./provisioning/adapter";
import { engineDefs, versionSchema } from "./engines";
import { getServerFor } from "./servers";

export const changeEngineSchema = z.object({ engine: z.string().trim().min(1).max(30), version: versionSchema });

/**
 * Zmiana silnika/wersji istniejącego serwera: panel dostaje nowy egg i zmienne, a serwer jest instalowany ponownie.
 * Pliki świata i konfiguracji zostają, ale instalator pobiera nowy plik serwera; zmiana w dół (starsza wersja) może uszkodzić świat.
 */
export async function changeEngine(actor: { id: string; role: string }, id: string, input: z.infer<typeof changeEngineSchema>) {
  const s = await getServerFor(actor, id);
  const adapter = getAdapter();
  if (!adapter.reinstall || s.isDemo) throw new ApiError(501, "NOT_AVAILABLE", "Zmiana silnika jest dostępna tylko dla prawdziwych serwerów");
  const defs = engineDefs(s.plan.game.features);
  if (!defs.length) throw new ApiError(400, "NO_ENGINES", "Ta gra nie ma wyboru silnika");
  const eng = defs.find((d) => d.key === input.engine);
  if (!eng) throw new ApiError(400, "BAD_ENGINE", "Wybrany silnik nie jest dostępny dla tej gry");
  // Zapisany status bywa nieaktualny (np. STOPPING po zatrzymaniu) — sprawdzamy rzeczywisty stan w panelu
  let status = s.status;
  if (status !== "OFFLINE" && ["RUNNING", "STARTING", "STOPPING"].includes(status)) {
    const live = await adapter.resources?.(s).catch(() => null);
    if (live) { status = live.state; if (status !== s.status) await db.server.update({ where: { id }, data: { status } }); }
  }
  if (status !== "OFFLINE") throw new ApiError(409, "NOT_OFFLINE", "Zatrzymaj serwer przed zmianą silnika lub wersji");
  if (s.subscription && s.subscription.status !== "ACTIVE") throw new ApiError(402, "SUBSCRIPTION_INACTIVE", "Usługa wygasła — odnów abonament");
  const cfg = (s.orderItem?.config ?? {}) as { envVars?: Record<string, string>; engine?: string; version?: string };
  try {
    await adapter.reinstall({ externalId: s.externalId }, { nestId: eng.nestId, eggId: eng.eggId, dockerImage: s.plan.dockerImage, envVars: { ...(cfg.envVars ?? {}), [eng.versionVar]: input.version } });
  } catch (e) {
    if (e instanceof ProvisioningError) throw new ApiError(e.retryable ? 503 : 502, "REINSTALL_FAILED", "Nie udało się rozpocząć reinstalacji serwera");
    throw e;
  }
  await db.$transaction([
    db.server.update({ where: { id }, data: { status: "INSTALLING" } }),
    db.orderItem.update({ where: { id: s.orderItemId }, data: { config: { ...cfg, engine: eng.key, version: input.version } } }),
  ]);
  await audit(actor.id, "server.engine.changed", "Server", id, { from: { engine: cfg.engine, version: cfg.version }, to: { engine: eng.key, version: input.version } });
  return { status: "INSTALLING" };
}
