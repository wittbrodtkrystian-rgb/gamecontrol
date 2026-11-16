import { route } from "@/lib/api";
import { db } from "@/lib/db";
export const POST = route({}, async ({ user }) => { await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } }); });
