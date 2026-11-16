// Sekrety czytane wyłącznie po stronie serwera (ten moduł nie może trafić do kodu klienta).
export const env = {
  get demoMode() { return (process.env.DEMO_MODE ?? "true") === "true"; },
  get appUrl() { return process.env.APP_URL ?? "http://localhost:3000"; },
  get cronSecret() { return process.env.CRON_SECRET ?? ""; },
  get stripeWebhookSecret() { return process.env.STRIPE_WEBHOOK_SECRET ?? ""; },
  get pteroUrl() { return process.env.PTERODACTYL_URL ?? ""; },
  get pteroClientKey() { return process.env.PTERODACTYL_CLIENT_API_KEY ?? ""; },
  get pteroKey() { return process.env.PTERODACTYL_APP_API_KEY ?? ""; },
};
