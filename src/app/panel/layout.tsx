import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { t } from "@/lib/i18n";
export const dynamic = "force-dynamic";
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/logowanie");
  const items: [string, string][] = [["/panel", t.panel.dashboard], ["/panel/serwery", t.panel.servers], ["/panel/zamow", t.panel.order], ["/panel/platnosci", t.panel.payments], ["/panel/ustawienia", t.panel.settings], ...(user.role !== "CUSTOMER" ? [["/admin", t.nav.admin] as [string, string]] : [])];
  return <AppShell items={items} user={user} title="Panel klienta">{children}</AppShell>;
}
