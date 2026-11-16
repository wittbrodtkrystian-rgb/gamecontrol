# GameControl Cloud — kontekst dla Claude Code

Platforma hostingu serwerów gier (Minecraft, CS2, Rust). Next.js 15 + TypeScript, Prisma + PostgreSQL, Tailwind. UI po polsku.
Uruchomienie, architektura i stan funkcji: `README.md`. Środowisko Pterodactyl: `docs/PTERODACTYL-LOCAL.md`.

## Zasady pracy
- Oszczędzaj tokeny: czytaj tylko pliki związane z zadaniem, minimalne poprawki, uruchamiaj tylko powiązane testy.
- Nie usuwaj funkcji ani zabezpieczeń. Nie deklaruj zaliczonych testów, jeśli ich nie uruchomiono.
- Żadnych prawdziwych płatności bez kluczy i osobnego zatwierdzenia użytkownika. Sekrety tylko w `.env` (nigdy w repo).
- Klucze Pterodactyl wyłącznie po stronie serwera.

## Stan (koniec sesji w chmurze)
- Etap 1 (MVP, tryb DEMO): gotowy. Etap 2: adapter Pterodactyl, synchronizacja węzłów, Client API — sprawdzone na mocku i na prawdziwym panelu 1.15.2 BEZ Wings
  (utworzenie serwera, zasilanie i metryki NIESPRAWDZONE — wymagają działającego Wings w WSL2/Linux).
- Etap 3: Stripe Checkout napisany, sprawdzony tylko na mocku; brak automatycznych odnowień i faktur.
- CS2: domyślny panel nie ma egga CS2 — zaimportuj oficjalny (eggs.pterodactyl.io/egg/games-counter-strike-2), potem wpisz nest/egg w Admin → Cenniki. Potrzebny token Steam GSLT.
- Testy: `npm test` (Vitest, wymaga bazy testowej `DATABASE_URL_TEST`). 22 testy przechodziły.

## Następne kroki
1. Postawić panel + Wings lokalnie, zweryfikować tworzenie serwera, start/stop, metryki.
2. Konfigurowanie zmiennych egga (np. GSLT) na zamówieniu.
3. Automatyczne odnowienia (Stripe subscriptions), potem Etap 4 (zgłoszenia, monitoring, raporty).
