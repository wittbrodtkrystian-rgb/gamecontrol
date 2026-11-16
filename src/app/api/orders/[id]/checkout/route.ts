import { route } from "@/lib/api";
import { createCheckout } from "@/server/payments";
export const POST = route<{ id: string }>({ limit: { key: "checkout", max: 10, windowSec: 600 } }, async ({ user, params }) => createCheckout(user.id, params.id));
