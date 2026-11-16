import { route, readJson } from "@/lib/api";
import { readFileText, writeFileText, writeFileSchema } from "@/server/files";
type P = { id: string };
const limit = { key: "files-content", max: 90, windowSec: 60 };
export const GET = route<P>({ limit }, async ({ req, user, params }) => readFileText(user, params.id, req.nextUrl.searchParams.get("path") ?? ""));
export const PUT = route<P>({ limit }, async ({ req, user, params }) => writeFileText(user, params.id, writeFileSchema.parse(await readJson(req))));
