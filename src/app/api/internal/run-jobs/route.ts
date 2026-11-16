import { timingSafeEqual } from "crypto";
import { route } from "@/lib/api";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/errors";
import { runDueJobs } from "@/server/provisioning/service";
import { processSubscriptions } from "@/server/subscriptions";
export const POST = route({ roles: "public", limit: { key: "jobs", max: 30, windowSec: 60 } }, async ({ req }) => {
  const given = Buffer.from(req.headers.get("x-cron-secret") ?? ""), want = Buffer.from(env.cronSecret);
  if (want.length < 24 || given.length !== want.length || !timingSafeEqual(given, want)) throw new ApiError(401, "UNAUTHORIZED", "Brak dostępu");
  return { jobs: await runDueJobs(), subscriptions: await processSubscriptions() };
});
