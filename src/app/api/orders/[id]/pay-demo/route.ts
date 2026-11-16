import { route } from "@/lib/api";
import { confirmDemoPayment } from "@/server/payments";
export const POST = route<{ id: string }>({ limit: { key: "pay", max: 10, windowSec: 600 } }, async ({ user, params }) => confirmDemoPayment(user.id, params.id));
