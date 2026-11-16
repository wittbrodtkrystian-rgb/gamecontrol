import { route, readJson } from "@/lib/api";
import { createOrder, createOrderSchema } from "@/server/orders";
export const POST = route({ roles: ["CUSTOMER", "ADMIN", "SUPPORT"], limit: { key: "order", max: 20, windowSec: 600 } }, async ({ req, user }) => {
  const order = await createOrder(user.id, createOrderSchema.parse(await readJson(req)));
  return { id: order.id, number: order.number, totalAmount: order.totalAmount, status: order.status };
});
