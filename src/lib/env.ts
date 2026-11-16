// Sekrety czytane wyłącznie po stronie serwera (ten moduł nie może trafić do kodu klienta).
export const env = {
  get demoMode() { return (process.env.DEMO_MODE ?? "true") === "true"; },
  get appUrl() { return process.env.APP_URL ?? "http://localhost:3000"; },
  get cronSecret() { return process.env.CRON_SECRET ?? ""; },
  get stripeWebhookSecret() { return process.env.STRIPE_WEBHOOK_SECRET ?? ""; },
  get pteroUrl() { return process.env.PTERODACTYL_URL ?? ""; },
  get pteroClientKey() { return process.env.PTERODACTYL_CLIENT_API_KEY ?? ""; },
  get stripeSecretKey() { return process.env.STRIPE_SECRET_KEY ?? ""; },
  get stripeApiBase() { return process.env.STRIPE_API_BASE ?? "https://api.stripe.com"; },
  /** Pula CPU węzła w % (100 = 1 wątek). Pterodactyl nie zwraca tej wartości, więc ustawia ją admin (np. 1200 dla 12 wątków). Brak/niepoprawna = 400. */
  get nodeCpuPercent() { const n = Number(process.env.NODE_CPU_PERCENT); return Number.isFinite(n) && n >= 100 ? Math.round(n) : 400; },
  get nodeCpuConfigured() { return !!process.env.NODE_CPU_PERCENT; },
  get pteroKey() { return process.env.PTERODACTYL_APP_API_KEY ?? ""; },
};
