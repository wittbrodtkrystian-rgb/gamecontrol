# GameControl Cloud — platforma hostingu serwerów gier

Etap 1 (MVP): strona publiczna, rejestracja/logowanie, panel klienta, panel administratora, katalog gier i pakietów,
zamówienia, płatności i provisioning w **trybie DEMO** (symulacja), baza PostgreSQL, testy.

> ⚠️ **TRYB DEMO**: serwery są symulowane, a „płatność" nie pobiera żadnych pieniędzy. Prawdziwy Pterodactyl i Stripe to Etap 2/3.

Stack: Next.js 15 + TypeScript, Tailwind CSS, PostgreSQL + Prisma, Zod. Redis jest w `docker-compose.yml`, ale **w Etapie 1 nie jest używany**
(kolejka provisioningu działa na tabeli `ProvisioningJob`; BullMQ planowany w Etapie 2). Interfejs: PL, szkielet EN w `src/lib/i18n`.

## Uruchomienie na Windows 11

Wymagane: [Node.js 20+ (LTS)](https://nodejs.org), [Git](https://git-scm.com), [Docker Desktop](https://www.docker.com/products/docker-desktop/) (z WSL2).
Polecenia w PowerShell, w katalogu `gamecontrol-cloud`:

```powershell
# 1. Usługi (PostgreSQL + Redis)
docker compose up -d

# 2. Zależności i konfiguracja
npm install
Copy-Item .env.example .env        # potem ustaw CRON_SECRET (min. 24 znaki) i opcjonalnie SEED_*_PASSWORD

# 3. Baza: migracje + dane startowe (gry, pakiety, węzeł DEMO, konta)
npx prisma migrate deploy
npm run db:seed                    # hasła kont wypisze w konsoli, jeśli nie ustawisz SEED_*_PASSWORD

# 4. Start
npm run dev                        # http://localhost:3000
```

Konta startowe (po seedzie): `admin@gamecontrol.local` (ADMIN), `support@gamecontrol.local` (SUPPORT), `klient@gamecontrol.local` (CUSTOMER).
Opcjonalnie w osobnym oknie: `npm run worker` (ponawianie zadań provisioningu i powiadomienia o wygasaniu).

Bez Dockera: zainstaluj PostgreSQL 16 lokalnie i ustaw `DATABASE_URL` w `.env`.

## Testy

```powershell
# osobna baza testowa (nigdy nie uruchamiaj testów na bazie z danymi!)
docker compose exec postgres createdb -U gamecontrol gamecontrol_test
$env:DATABASE_URL_TEST="postgresql://gamecontrol:gamecontrol@localhost:5432/gamecontrol_test?schema=public"
$env:DATABASE_URL=$env:DATABASE_URL_TEST; npx prisma migrate deploy
npm test               # testy integracyjne backendu (Vitest + prawdziwy PostgreSQL)
npm run typecheck
npm run build
```
E2E + responsywność (Playwright, opcjonalnie): `npm i -D playwright; npx playwright install chromium; npm run build; npm start`,
a w drugim oknie `$env:ADMIN_PASSWORD="..."; node e2e/smoke.js`.

## Architektura

| Warstwa | Lokalizacja |
|---|---|
| Frontend (RSC + komponenty klienckie) | `src/app`, `src/components` |
| Backend API (opakowanie `route()`: sesja, role, rate limit, Origin/CSRF, Zod) | `src/app/api`, `src/lib/api.ts` |
| Zamówienia | `src/server/orders.ts` |
| Płatności (DEMO + webhook z weryfikacją podpisu HMAC) | `src/server/payments.ts` |
| Provisioning (job, retry/backoff, idempotencja, brak zasobów) | `src/server/provisioning/service.ts` |
| Adaptery: DEMO i Pterodactyl | `src/server/provisioning/{demo,pterodactyl}.ts` |
| Sterowanie serwerem, metryki, kopie | `src/server/servers.ts` |
| Abonamenty, wygasanie, powiadomienia | `src/server/subscriptions.ts`, `worker.ts` |
| Schemat bazy | `prisma/schema.prisma`, `prisma/migrations` |

Przepływ: zamówienie (`PENDING_PAYMENT`) → potwierdzona płatność → subskrypcja + `ProvisioningJob` → wybór węzła z wolnymi zasobami →
rezerwacja alokacji → adapter tworzy serwer → `COMPLETED`. Brak zasobów = `WAITING_RESOURCES` + alert dla admina; błędy = ponowienia z backoffem (max 5), potem `FAILED`.

## Bezpieczeństwo (zaimplementowane)

Hasła bcrypt(12); sesje w bazie (hash tokenu SHA-256, cookie HttpOnly/SameSite=Lax); blokada konta po 5 błędnych logowaniach; rate limiting;
walidacja Zod; role ADMIN/SUPPORT/CUSTOMER egzekwowane w backendzie; ochrona IDOR (cudzy zasób = 404); ceny tylko z bazy;
sprawdzanie `Origin`; weryfikacja podpisu webhooka (stały czas, tolerancja czasu, sprawdzenie kwoty, idempotencja po `event.id`);
audyt działań; nagłówki bezpieczeństwa; brak endpointu wykonującego komendy systemowe; klucze Pterodactyl tylko w env serwera.

**Ograniczenia MVP (świadome):** rate limiter działa w pamięci procesu (przy wielu instancjach przenieś do Redis); brak weryfikacji e-mail i resetu hasła;
brak 2FA; faktury i zwroty niezaimplementowane.

## Co działa, a co wymaga kluczy / hostingu

| Funkcja | Stan |
|---|---|
| Rejestracja, logowanie, role, panel klienta i admina | ✅ działa |
| Katalog gier/pakietów, edycja cennika i limitów (admin) | ✅ działa |
| Zamówienie → płatność DEMO → automatyczny (symulowany) serwer | ✅ działa |
| Start/stop/restart/kill, kopie zapasowe (rekordy), statystyki | ✅ DEMO (dane syntetyczne) |
| Konsola | ⚠️ symulowana w DEMO |
| Menedżer plików, instalacja pluginów, zmiana wersji, wipe, mapy Workshop | ❌ Etap 2 (wymaga Pterodactyl/Wings) |
| Prawdziwy provisioning | ⚠️ adapter napisany wg dokumentacji API, **nietestowany na żywym panelu**; wymaga `PTERODACTYL_URL`, `PTERODACTYL_APP_API_KEY`, węzłów Wings na Linuxie, eggów (`eggId` w pakiecie) |
| Stripe / abonamenty / odnowienia | ❌ Etap 3; gotowy jest tylko webhook z weryfikacją podpisu (`STRIPE_WEBHOOK_SECRET`) |
| Zgłoszenia, zaawansowany monitoring, raporty | ❌ Etap 4 (tabele w schemacie) |

Wings działa wyłącznie na osobnych serwerach Linux — nie instaluj go na Windows.

## Przełączenie na produkcję

`DEMO_MODE="false"` wyłącza płatności i adapter DEMO (zamówień nie da się wtedy opłacić do czasu Etapu 3). Ustaw silne `CRON_SECRET`, wywołuj
`POST /api/internal/run-jobs` z nagłówkiem `x-cron-secret` (np. co minutę) albo uruchom `npm run worker`. Nigdy nie commituj `.env`.
