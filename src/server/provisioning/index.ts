import { env } from "@/lib/env";
import type { GameServerAdapter } from "./adapter";
import { DemoAdapter } from "./demo";
import { PterodactylAdapter } from "./pterodactyl";
let override: GameServerAdapter | null = null;
/** Do testów: podmiana adaptera (np. symulacja awarii). */
export const setAdapterForTests = (a: GameServerAdapter | null) => { override = a; };
export function getAdapter(): GameServerAdapter {
  if (override) return override;
  return env.demoMode ? new DemoAdapter() : new PterodactylAdapter();
}
