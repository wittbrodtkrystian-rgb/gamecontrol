import "dotenv/config";
// Testy działają na osobnej bazie (DATABASE_URL_TEST), nigdy na bazie developerskiej.
process.env.DATABASE_URL = process.env.DATABASE_URL_TEST ?? "postgresql://gamecontrol:gamecontrol@localhost:5432/gamecontrol_test?schema=public";
process.env.DEMO_MODE = "true";
process.env.CRON_SECRET = "test-cron-secret-0123456789abcdef";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";
