import { db } from "@/lib/db";
export const notify = (userId: string, type: string, title: string, body: string) =>
  db.notification.create({ data: { userId, type, title, body } });
export async function notifyStaff(type: string, title: string, body: string) {
  const staff = await db.user.findMany({ where: { role: "ADMIN", disabledAt: null }, select: { id: true } });
  await db.notification.createMany({ data: staff.map((u) => ({ userId: u.id, type, title, body })) });
}
