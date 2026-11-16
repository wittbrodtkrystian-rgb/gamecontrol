type Dict = { nav: Record<"home"|"offer"|"games"|"faq"|"login"|"register"|"panel"|"admin"|"logout", string>; panel: Record<"dashboard"|"servers"|"order"|"payments"|"settings", string>; admin: Record<"dashboard"|"customers"|"orders"|"servers"|"nodes"|"pricing"|"payments"|"audit"|"staff", string>; demoBanner: string; perMonth: string };
export const pl: Dict = {
  nav: { home: "Strona główna", offer: "Oferta", games: "Gry", faq: "FAQ", login: "Zaloguj się", register: "Załóż konto", panel: "Panel klienta", admin: "Administracja", logout: "Wyloguj" },
  panel: { dashboard: "Dashboard", servers: "Moje serwery", order: "Zamów serwer", payments: "Płatności", settings: "Ustawienia" },
  admin: { dashboard: "Dashboard", customers: "Klienci", orders: "Zamówienia", servers: "Serwery", nodes: "Węzły i zasoby", pricing: "Cenniki", payments: "Płatności", audit: "Logi audytowe", staff: "Pracownicy" },
  demoBanner: "TRYB DEMO — serwery i płatności są symulowane. Nie pobieramy pieniędzy.",
  perMonth: "/mies.",
};
