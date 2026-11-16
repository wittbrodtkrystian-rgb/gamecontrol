import { route, readJson } from "@/lib/api";
import { powerServer, powerSchema } from "@/server/servers";
export const POST = route<{ id: string }>({ limit: { key: "power", max: 30, windowSec: 60 } }, async ({ req, user, params }) =>
  powerServer(user, params.id, powerSchema.parse(await readJson(req)).action));
