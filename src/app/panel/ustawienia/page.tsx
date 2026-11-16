import { getCurrentUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import { SettingsForm } from "@/components/Controls";
export const dynamic = "force-dynamic";
export default async function Settings() { const u = (await getCurrentUser())!; return <><PageTitle sub={u.email}>Ustawienia konta</PageTitle><SettingsForm name={u.name} /></>; }
