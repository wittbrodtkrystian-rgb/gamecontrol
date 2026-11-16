import { route } from "@/lib/api";
import { getMetrics } from "@/server/servers";
export const GET = route<{ id: string }>({}, async ({ user, params }) => getMetrics(user, params.id));
