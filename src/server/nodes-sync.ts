import { db } from "@/lib/db";
import { app } from "./provisioning/pterodactyl";
import { audit } from "@/lib/audit";

type PNode = { attributes: { id: number; name: string; fqdn: string; memory: number; memory_overallocate: number; disk: number; disk_overallocate: number; maintenance_mode: boolean } };
type PAlloc = { attributes: { id: number; ip: string; port: number } };

/** Import/odświeżenie węzłów i alokacji z Pterodactyl. Nie nadpisuje ręcznych ustawień enabled/maintenance istniejących węzłów. */
export async function syncNodes(actorId: string | null) {
  const nodes = ((await app("GET", "/nodes?per_page=100")).data ?? []) as PNode[];
  let allocs = 0;
  for (const n of nodes) {
    const a = n.attributes;
    const node = await db.node.upsert({
      where: { pterodactylNodeId: a.id },
      update: { fqdn: a.fqdn, ramTotalMb: a.memory, diskTotalMb: a.disk },
      create: { name: a.name, fqdn: a.fqdn, location: "Pterodactyl", ramTotalMb: a.memory, diskTotalMb: a.disk, cpuTotal: 400, pterodactylNodeId: a.id, maintenance: a.maintenance_mode },
    });
    for (let page = 1; ; page++) {
      const r = await app("GET", `/nodes/${a.id}/allocations?per_page=100&page=${page}`);
      for (const x of (r.data ?? []) as PAlloc[]) {
        await db.allocation.upsert({ where: { nodeId_ip_port: { nodeId: node.id, ip: x.attributes.ip, port: x.attributes.port } }, update: { pterodactylId: x.attributes.id }, create: { nodeId: node.id, ip: x.attributes.ip, port: x.attributes.port, pterodactylId: x.attributes.id } });
        allocs++;
      }
      if (page >= (r.meta?.pagination?.total_pages ?? 1)) break;
    }
  }
  await audit(actorId, "admin.nodes.synced", "Node", undefined, { nodes: nodes.length, allocations: allocs });
  return { nodes: nodes.length, allocations: allocs };
}
