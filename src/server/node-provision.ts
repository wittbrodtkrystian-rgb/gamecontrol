import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/errors";
import { app } from "./provisioning/pterodactyl";
import { syncNodes } from "./nodes-sync";

/**
 * Etap A skalowania: admin podaje dane nowej maszyny (kupionej ręcznie), aplikacja tworzy węzeł i alokacje w Pterodactylu
 * i generuje skrypt instalacji Wings do uruchomienia na tej maszynie. Aplikacja NIE zamawia maszyn i niczego nie kupuje.
 */
const hostRe = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/;
export const provisionNodeSchema = z.object({
  name: z.string().trim().min(3).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9 ._-]*$/, "Niedozwolone znaki w nazwie"),
  fqdn: z.string().trim().min(3).max(253).regex(hostRe, "Niepoprawny adres (domena lub IP)"),
  ip: z.string().trim().ip({ version: "v4" }),
  scheme: z.enum(["http", "https"]).default("https"),
  memoryMb: z.number().int().min(1024).max(4_000_000),
  diskMb: z.number().int().min(10_000).max(100_000_000),
  cpuPercent: z.number().int().min(100).max(25_600),
  ports: z.string().trim().min(1).max(300),
  daemonPort: z.number().int().min(1024).max(65535).default(8080),
  sftpPort: z.number().int().min(1024).max(65535).default(2022),
}).refine((v) => !(v.scheme === "https" && /^\d+\.\d+\.\d+\.\d+$/.test(v.fqdn)), { message: "HTTPS wymaga domeny (certyfikat nie powstanie dla samego IP)", path: ["fqdn"] });
export type ProvisionNodeInput = z.infer<typeof provisionNodeSchema>;

/** "25565-25599, 27015" -> ["25565-25599", "27015"]; porty 1024-65535, razem maks. 1000. */
export function parsePorts(raw: string): string[] {
  const out: string[] = []; let total = 0;
  for (const part of raw.split(",").map((p) => p.trim()).filter(Boolean)) {
    const m = /^(\d{4,5})(?:-(\d{4,5}))?$/.exec(part);
    if (!m) throw new ApiError(400, "BAD_PORTS", `Niepoprawny zakres portów: ${part.slice(0, 20)}`);
    const a = +m[1], b = m[2] ? +m[2] : a;
    if (a < 1024 || b > 65535 || b < a) throw new ApiError(400, "BAD_PORTS", "Porty muszą mieścić się w 1024–65535");
    total += b - a + 1; out.push(a === b ? String(a) : `${a}-${b}`);
  }
  if (!out.length || total > 1000) throw new ApiError(400, "BAD_PORTS", "Podaj od 1 do 1000 portów");
  return out;
}

const DELIM = "GC_WINGS_CONFIG_EOF";
/** Skrypt instalacji Wings (Debian/Ubuntu). Zawiera token węzła — pokazujemy go adminowi tylko raz i nie zapisujemy. */
export function buildWingsInstallScript(a: { config: string; fqdn: string; scheme: string; daemonPort: number; sftpPort: number; ports: string[] }) {
  if (a.config.includes(DELIM)) throw new ApiError(502, "BAD_CONFIG", "Nieoczekiwana konfiguracja Wings z panelu");
  const exec = a.scheme === "https" ? `/usr/local/bin/wings --auto-tls --tls-hostname ${a.fqdn}` : "/usr/local/bin/wings";
  const fw = [`${a.daemonPort}/tcp`, `${a.sftpPort}/tcp`, ...(a.scheme === "https" ? ["80/tcp", "443/tcp"] : []), ...a.ports.map((p) => `${p.replace("-", ":")}/tcp`), ...a.ports.map((p) => `${p.replace("-", ":")}/udp`)];
  return `#!/usr/bin/env bash
# GameControl Cloud — instalacja Wings. Uruchom jako root na czystym Debian/Ubuntu (x86_64 lub arm64).
# UWAGA: plik zawiera token węzła. Nie zapisuj go w repozytorium i usuń po instalacji.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Uruchom jako root"; exit 1; }
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates docker.io
systemctl enable --now docker
mkdir -p /etc/pterodactyl /var/lib/pterodactyl/volumes /var/log/pterodactyl /tmp/pterodactyl
case "$(uname -m)" in x86_64) ARCH=amd64;; aarch64) ARCH=arm64;; *) echo "Nieobsługiwana architektura"; exit 1;; esac
curl -fsSL -o /usr/local/bin/wings "https://github.com/pterodactyl/wings/releases/latest/download/wings_linux_$ARCH"
chmod +x /usr/local/bin/wings
umask 077
cat > /etc/pterodactyl/config.yml <<'${DELIM}'
${a.config}
${DELIM}
chmod 600 /etc/pterodactyl/config.yml
cat > /etc/systemd/system/wings.service <<'GC_UNIT_EOF'
[Unit]
Description=Pterodactyl Wings Daemon
After=docker.service
Requires=docker.service
PartOf=docker.service

[Service]
User=root
WorkingDirectory=/etc/pterodactyl
LimitNOFILE=4096
PIDFile=/var/run/wings/daemon.pid
ExecStart=${exec}
Restart=on-failure
StartLimitInterval=180
StartLimitBurst=30
RestartSec=5s

[Install]
WantedBy=multi-user.target
GC_UNIT_EOF
systemctl daemon-reload
systemctl enable --now wings
# Zapora sieciowa (jeśli używasz ufw):
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
${fw.map((r) => `  ufw allow ${r}`).join("\n")}
fi
echo "Gotowe. Sprawdź: systemctl status wings"
`;
}

export async function provisionNode(actorId: string, input: ProvisionNodeInput, ip?: string) {
  if (env.demoMode) throw new ApiError(400, "DEMO_MODE", "Dodawanie węzłów Pterodactyl wymaga DEMO_MODE=false");
  const ports = parsePorts(input.ports);
  if (await db.node.findUnique({ where: { name: input.name } })) throw new ApiError(409, "NODE_EXISTS", "Węzeł o tej nazwie już istnieje");

  // Lokalizacja "gamecontrol" (tworzona raz)
  const locs = await app("GET", "/locations?filter[short]=gamecontrol");
  const locId: number = locs?.data?.[0]?.attributes?.id ?? (await app("POST", "/locations", { short: "gamecontrol", long: "GameControl Cloud" })).attributes.id;

  const created = await app("POST", "/nodes", {
    name: input.name, location_id: locId, fqdn: input.fqdn, scheme: input.scheme, behind_proxy: false, public: true, maintenance_mode: false,
    memory: input.memoryMb, memory_overallocate: 0, disk: input.diskMb, disk_overallocate: 0, upload_size: 100,
    daemon_base: "/var/lib/pterodactyl/volumes", daemon_listen: input.daemonPort, daemon_sftp: input.sftpPort,
  });
  const pteroId: number = created.attributes.id;
  let config: string;
  try {
    await app("POST", `/nodes/${pteroId}/allocations`, { ip: input.ip, ports });
    config = JSON.stringify(await app("GET", `/nodes/${pteroId}/configuration`), null, 2); // JSON jest poprawnym YAML-em
  } catch (e) {
    await app("DELETE", `/nodes/${pteroId}`).catch(() => null); // nie zostawiaj węzła-sieroty w panelu
    throw e;
  }
  await syncNodes(actorId);
  await db.node.updateMany({ where: { pterodactylNodeId: pteroId }, data: { cpuTotal: input.cpuPercent } });
  const node = await db.node.findFirstOrThrow({ where: { pterodactylNodeId: pteroId } });
  await audit(actorId, "admin.node.provisioned", "Node", node.id, { name: input.name, fqdn: input.fqdn, ports: ports.length }, ip); // bez tokenu i skryptu
  return { nodeId: node.id, pterodactylNodeId: pteroId, script: buildWingsInstallScript({ config, fqdn: input.fqdn, scheme: input.scheme, daemonPort: input.daemonPort, sftpPort: input.sftpPort, ports }) };
}
