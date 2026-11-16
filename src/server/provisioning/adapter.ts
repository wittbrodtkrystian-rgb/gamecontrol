import type { ServerStatus } from "@prisma/client";

export type PowerAction = "start" | "stop" | "restart" | "kill";
export interface CreateServerInput {
  name: string; ownerEmail: string; ownerName: string; gameSlug: string;
  ramMb: number; cpuPercent: number; diskMb: number;
  node: { id: string; pterodactylNodeId: number | null };
  allocation: { ip: string; port: number; externalId: number | null };
  nestId: number | null;
  eggId: number | null; dockerImage: string | null;
  /** Klucz idempotencji (id pozycji zamówienia) — adapter nie może utworzyć duplikatu. */
  idempotencyKey: string;
  /** Zmienne egga wybrane przez klienta przy zamówieniu (np. token GSLT); adapter filtruje je do user_editable. */
  envVars?: Record<string, string>;
}
export class ProvisioningError extends Error {
  constructor(message: string, public retryable = true) { super(message); }
}
export interface GameServerAdapter {
  readonly name: string;
  readonly isDemo: boolean;
  createServer(input: CreateServerInput): Promise<{ externalId: string; externalUuid: string }>;
  /** Zwraca docelowy status po wykonaniu akcji. */
  power(server: { externalId: string | null; externalUuid: string | null }, action: PowerAction): Promise<ServerStatus>;
  /** Odczyt stanu i zasobów (Client API). null = brak danych. */
  resources?(server: { externalUuid: string | null }): Promise<{ state: ServerStatus; cpu: number; ramMb: number; diskMb: number; netInKb: number; netOutKb: number } | null>;
  suspend(server: { externalId: string | null }, suspended: boolean): Promise<void>;
  deleteServer(server: { externalId: string | null }): Promise<void>;
}
