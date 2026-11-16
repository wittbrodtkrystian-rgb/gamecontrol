import { route, readJson } from "@/lib/api";
import { changeEngine, changeEngineSchema } from "@/server/engine-change";
export const POST = route<{ id: string }>({ limit: { key: "engine", max: 5, windowSec: 300 } }, async ({ req, user, params }) =>
  changeEngine(user, params.id, changeEngineSchema.parse(await readJson(req))));
