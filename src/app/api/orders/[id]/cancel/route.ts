import { route } from "@/lib/api";
import { cancelOrder } from "@/server/orders";
export const POST = route<{ id: string }>({}, async ({ user, params }) => cancelOrder(user, params.id));
