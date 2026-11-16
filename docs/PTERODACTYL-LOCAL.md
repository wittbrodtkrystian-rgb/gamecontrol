# Lokalne środowisko testowe Pterodactyl (Windows 11)

Wszystko jest darmowe. Panel działa w Dockerze, a Wings (demon uruchamiający serwery gier) **musi działać na Linuksie** — lokalnie w WSL2.
> Uwaga: ta instrukcja i plik compose nie zostały przeze mnie uruchomione (środowisko, w którym pracuję, nie ma demona Dockera). Traktuj je jako start do weryfikacji.

## 1. Panel
```powershell
cd infra\pterodactyl
docker compose up -d
docker compose exec panel php artisan p:user:make     # utwórz konto admina (e-mail, hasło, admin = yes)
```
Panel: http://localhost:8080 (pierwszy start trwa ok. minuty — migracje).

## 2. Konfiguracja w panelu (Admin → …)
1. **Locations** → utwórz lokalizację (np. `local`).
2. **Nodes** → utwórz węzeł: FQDN `localhost`, bez SSL, port Wings 8080 → **zmień na 8081** (8080 zajmuje panel) i SFTP 2022; pamięć/dysk dowolne (np. 8192 MB).
3. W węźle → **Allocations** → dodaj IP `0.0.0.0` (lub IP WSL) i porty np. `25565-25575`.
4. **Application API**: konto admina → *Application API* → **Create** z prawami Read & Write dla: Servers, Users, Nodes, Allocations, Locations, Nests, Eggs. Skopiuj klucz (`ptla_...`) — pokazuje się raz.
5. Egg-i (Minecraft Paper, Rust itd.) są w nest-ach domyślnie; ich `id` zobaczysz w *Nests → Egg*. Wpisz je do pakietów (`pterodactylEggId`).

## 3. Wings w WSL2 (Ubuntu)
```powershell
wsl --install -d Ubuntu     # jeśli nie masz
```
W Ubuntu zainstaluj Docker Engine i Wings wg oficjalnej instrukcji https://pterodactyl.io/wings/1.0/installing.html, a konfigurację (`config.yml`)
skopiuj z zakładki *Configuration* węzła. Ustaw w niej port API 8081. Wings na WSL2 bywa kapryśny — to tylko środowisko testowe.

## 4. Podpięcie GameControl Cloud
W `.env` (nigdy nie commituj):
```
DEMO_MODE="false"
PTERODACTYL_URL="http://localhost:8080"
PTERODACTYL_APP_API_KEY="ptla_..."
```

## Weryfikacja na prawdziwym panelu (Pterodactyl 1.15.2, uruchomionym natywnie, bez Wings)
Sprawdzone: synchronizacja węzłów i alokacji, tworzenie użytkownika w panelu, pobranie egga i wysłanie żądania `POST /servers`
(przeszło walidację API; zatrzymało się dopiero na braku połączenia z Wings -> 504, ponawialny). **Niesprawdzone:** faktyczne utworzenie
serwera, zasilanie i metryki — wymagają działającego Wings.

ID z domyślnie zasianego panelu 1.15.2 (sprawdzone na żywo): nest 1 Minecraft = Bungeecord 1, Sponge 2, **Paper 3**, Forge 4, **Vanilla 5**; Rust = nest 4 / egg 14.
(Wcześniejsza wersja tego pliku podawała błędnie Paper = 5 / Vanilla = 4.) Silniki Purpur i Fabric trzeba zaimportować (eggs.pterodactyl.io), a ich ID wpisać w `Game.features.engineEggs`.
**Counter-Strike 2 nie ma domyślnego egga** (jest tylko CS:GO) — trzeba zaimportować własny egg CS2 w panelu (Admin → Nests → Import Egg).

## Co jest już w kodzie (sprawdzone tylko na MOCKU API, nie na żywym panelu)
- Synchronizacja węzłów i alokacji: `POST /api/admin/nodes/sync` (tylko ADMIN, zalogowany w przeglądarce).
- Tworzenie serwera: użytkownik w Pterodactyl, pobranie egga (startup, zmienne), alokacja, idempotencja po `external_id`.
- Zasilanie (start/stop/restart/kill) i stan/zasoby przez Client API (`PTERODACTYL_CLIENT_API_KEY` — klucz z *Account → API Credentials* konta admina).
- W panelu GameControl dla każdego pakietu ustaw `pterodactylNestId` i `pterodactylEggId` (na razie przez bazę/Prisma Studio: `npx prisma studio`; edycja w UI to kolejny krok).

## Jeszcze brakuje
- Pola nest/egg w edytorze cenników (UI).
- Konsola na żywo (WebSocket Wings), menedżer plików, kopie zapasowe przez API, prawdziwe pluginy/wipe.
- Weryfikacja na prawdziwym panelu — spodziewaj się drobnych poprawek.
