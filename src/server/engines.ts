import { z } from "zod";

/**
 * Silniki gry wybierane przy zamówieniu (np. Minecraft: Paper/Vanilla/Purpur/Fabric). Każdy silnik to osobny egg w Pterodactylu.
 * Definicje są w Game.features.engineEggs; ID nest/egg zależą od panelu (sprawdź w Admin → Nests).
 */
export type EngineDef = { key: string; label: string; nestId: number; eggId: number; versionVar: string };

export function engineDefs(features: unknown): EngineDef[] {
  const raw = (features as { engineEggs?: unknown } | null)?.engineEggs;
  if (!Array.isArray(raw)) return [];
  return raw.filter((e): e is EngineDef => !!e && typeof e.key === "string" && typeof e.label === "string" && Number.isInteger(e.nestId) && Number.isInteger(e.eggId) && typeof e.versionVar === "string");
}

/** "latest" albo konkretna wersja, np. 1.21.4 (bez dowolnego tekstu trafiającego do skryptu instalacji eggu). */
export const versionSchema = z.string().trim().regex(/^(latest|\d{1,2}\.\d{1,2}(\.\d{1,2})?)$/, "Podaj wersję, np. 1.21.4 lub latest");
