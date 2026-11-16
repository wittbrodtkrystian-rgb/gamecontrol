import { route, readJson } from "@/lib/api";
import { listFiles, makeFolder, deleteFiles, renameFile, mkdirSchema, deleteSchema, renameSchema } from "@/server/files";
type P = { id: string };
const limit = { key: "files", max: 120, windowSec: 60 };
export const GET = route<P>({ limit }, async ({ req, user, params }) => listFiles(user, params.id, req.nextUrl.searchParams.get("dir") ?? "/"));
export const POST = route<P>({ limit }, async ({ req, user, params }) => makeFolder(user, params.id, mkdirSchema.parse(await readJson(req))));
export const PATCH = route<P>({ limit }, async ({ req, user, params }) => renameFile(user, params.id, renameSchema.parse(await readJson(req))));
export const DELETE = route<P>({ limit }, async ({ req, user, params }) => deleteFiles(user, params.id, deleteSchema.parse(await readJson(req))));
