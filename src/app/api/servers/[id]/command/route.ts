import { route, readJson } from "@/lib/api";
import { sendCommand, commandSchema } from "@/server/servers";
export const POST = route<{ id: string }>({ limit: { key: "cmd", max: 60, windowSec: 60 } }, async ({ req, user, params }) =>
  sendCommand(user, params.id, commandSchema.parse(await readJson(req)).command));
