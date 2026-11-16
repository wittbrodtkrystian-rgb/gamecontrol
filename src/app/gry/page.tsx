import type { Metadata } from "next";
import { PublicShell } from "@/components/PublicShell";
import { db } from "@/lib/db";
export const metadata: Metadata = { title: "Obsługiwane gry" };
export const dynamic = "force-dynamic";

const notes: Record<string, string> = {
  minecraft: "Instalacja pluginów i zmiana wersji zależą od integracji z Pterodactyl (Etap 2) — w trybie DEMO są tylko zaprezentowane w panelu.",
  cs2: "Dodatki (Metamod, CounterStrikeSharp) i mapy Workshop wymagają odpowiedniego egga w Pterodactyl i klucza Steam GSLT.",
  rust: "Pluginy działają tylko na silniku modded (uMod/Oxide). Wipe jest wykonywany przez panel po integracji (Etap 2).",
};
export default async function Games() {
  const games = await db.game.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } });
  return (
    <PublicShell><div className="mx-auto max-w-4xl px-4 pt-12"><h1 className="text-3xl font-bold">Obsługiwane gry</h1>
      <div className="mt-6 space-y-4">{games.map((g) => {
        const f = g.features as Record<string, unknown>;
        return <div key={g.id} className="card"><h2 className="text-xl font-semibold">{g.name}</h2><p className="mt-1 text-sm text-slate-400">{g.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">{[...((f.engines as string[]) ?? []), ...((f.modes as string[]) ?? [])].map((x) => <span key={x} className="rounded-full border border-line px-3 py-1 text-xs">{x}</span>)}</div>
          {notes[g.slug] && <p className="mt-3 text-xs text-amber-300/80">ℹ {notes[g.slug]}</p>}</div>;
      })}</div></div></PublicShell>
  );
}
