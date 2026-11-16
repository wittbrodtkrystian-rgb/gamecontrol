import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/logowanie");
  if (user.role === "CUSTOMER") redirect("/panel"); // autoryzacja po stronie serwera
  const a = t.admin;
  const items: [string, string][] = [["/admin", a.dashboard], ["/admin/klienci", a.customers], ["/admin/zamowienia", a.orders], ["/admin/serwery", a.servers], ["/admin/wezly", a.nodes], ["/admin/cennik", a.pricing], ["/admin/platnosci", a.payments], ["/admin/audyt", a.audit], ["/admin/pracownicy", a.staff], ["/panel", t.nav.panel]];
  return <AppShell items={items} user={user} title={`Administracja · ${user.role}`}>{children}</AppShell>;
}
