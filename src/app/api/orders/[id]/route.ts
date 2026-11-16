import { route } from "@/lib/api";
import { getOrderFor } from "@/server/orders";
export const GET = route<{ id: string }>({}, async ({ user, params }) => getOrderFor(user, params.id));
