import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { handlePaymentWebhook } from "@/server/payments";
export const POST = route({ roles: "public", limit: { key: "webhook", max: 120, windowSec: 60 } }, async ({ req }) => {
  const raw = await req.text(); // surowe ciało wymagane do weryfikacji podpisu
  return NextResponse.json(await handlePaymentWebhook(raw, req.headers.get("stripe-signature")));
});
