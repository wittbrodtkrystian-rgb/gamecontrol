import type { pl } from "./pl";

// Szkielet tłumaczenia angielskiego — uzupełnij i przełącz w getDict() (kolejny etap).
export const en: typeof pl = {
  nav: { home: "Home", offer: "Plans", games: "Games", faq: "FAQ", login: "Log in", register: "Sign up", panel: "Dashboard", admin: "Admin", logout: "Log out" },
  panel: { dashboard: "Dashboard", servers: "My servers", order: "Order server", payments: "Billing", settings: "Settings" },
  admin: { dashboard: "Dashboard", customers: "Customers", orders: "Orders", servers: "Servers", nodes: "Nodes & resources", pricing: "Pricing", payments: "Payments", audit: "Audit log", staff: "Staff" },
  demoBanner: "DEMO MODE — servers and payments are simulated. No money is charged.",
  perMonth: "/mo",
};
