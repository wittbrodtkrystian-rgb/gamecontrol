import { db } from "@/lib/db";
import { PageTitle } from "@/components/ui";
import { OrderForm } from "@/components/Controls";
import { formatPln } from "@/lib/money";
export const dynamic = "force-dynamic";
export default async function Order({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const plans = await db.hostingPlan.findMany({ where: { available: true, game: { enabled: true } }, include: { game: true }, orderBy: [{ game: { sortOrder: "asc" } }, { priceMonthly: "asc" }] });
  return <><PageTitle sub="Wybierz grę i pakiet. Płatność w kolejnym kroku.">Zamów nowy serwer</PageTitle>
    <OrderForm initial={(await searchParams).plan} plans={plans.map((p) => ({ id: p.id, label: `${p.game.name} ${p.name} (${p.ramMb / 1024} GB RAM, ${p.slots} slotów)`, price: formatPln(p.priceMonthly) }))} /></>;
}
