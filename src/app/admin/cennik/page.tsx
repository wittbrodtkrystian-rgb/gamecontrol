import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { PlanEditor } from "@/components/AdminControls";
export const dynamic = "force-dynamic";
export default async function Pricing() {
  const user = (await getCurrentUser())!;
  const plans = await db.hostingPlan.findMany({ include: { game: true }, orderBy: [{ game: { sortOrder: "asc" } }, { priceMonthly: "asc" }] });
  return (<><PageTitle sub={user.role === "ADMIN" ? "Edytuj ceny, limity i dostępność. Zmiany są zapisywane w logu audytowym." : "Podgląd — edycja tylko dla roli ADMIN."}>Cenniki</PageTitle>
    <div className="space-y-4">{plans.map((p) => <PlanEditor key={p.id} game={p.game.name} canEdit={user.role === "ADMIN"} plan={{ id: p.id, name: p.name, priceMonthly: p.priceMonthly, ramMb: p.ramMb, cpuPercent: p.cpuPercent, diskMb: p.diskMb, slots: p.slots, available: p.available }} />)}</div></>);
}
