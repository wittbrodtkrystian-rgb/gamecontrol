import { route } from "@/lib/api";
import { renewDemo } from "@/server/subscriptions";
export const POST = route<{ id: string }>({ limit: { key: "renew", max: 10, windowSec: 600 } }, async ({ user, params }) => renewDemo(user.id, params.id));
