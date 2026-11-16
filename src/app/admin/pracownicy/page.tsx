import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { PageTitle, Table } from "@/components/ui";
import { UserControls } from "@/components/AdminControls";
export const dynamic = "force-dynamic";
export default async function Staff() {
  const me = (await getCurrentUser())!;
  const staff = await db.user.findMany({ where: { role: { in: ["ADMIN", "SUPPORT"] } }, orderBy: { createdAt: "asc" } });
  return (<><PageTitle sub="ADMIN: pełny dostęp i edycja. SUPPORT: podgląd paneli administracyjnych. Aby nadać rolę klientowi, użyj API /api/admin/users/[id].">Uprawnienia pracowników</PageTitle>
    <Table head={["E-mail", "Nazwa", "Rola / akcje"]}>{staff.map((u) => <tr key={u.id}><td className="td">{u.email}</td><td className="td">{u.name}</td><td className="td">{me.role === "ADMIN" && u.id !== me.id ? <UserControls id={u.id} role={u.role} disabled={!!u.disabledAt} /> : u.role}</td></tr>)}</Table></>);
}
