import { randomUUID } from "crypto";
import type { GameServerAdapter, PowerAction } from "./adapter";
import type { ServerStatus } from "@prisma/client";

/** Adapter DEMONSTRACYJNY — nie tworzy żadnych prawdziwych serwerów. */
export class DemoAdapter implements GameServerAdapter {
  readonly name = "DEMO (symulacja)";
  readonly isDemo = true;
  async createServer(input: { idempotencyKey: string }) {
    return { externalId: `demo-${input.idempotencyKey}`, externalUuid: randomUUID() };
  }
  async power(_s: unknown, action: PowerAction): Promise<ServerStatus> {
    return action === "start" || action === "restart" ? "RUNNING" : "OFFLINE";
  }
  async suspend() {}
  async deleteServer() {}
}
