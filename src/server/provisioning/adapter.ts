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
  /** Dodatkowe alokacje serwera (np. port txAdmin). */
  extraAllocations?: { ip: string; port: number; externalId: number | null }[];
  /** Zmienne ustawiane przez platformę (nie przez klienta), nadpisują domyślne wartości egga niezależnie od user_editable. */
  systemVars?: Record<string, string>;
}
export class ProvisioningError extends Error {
  constructor(message: string, public retryable = true) { super(message); }
}
export interface FileEntry { name: string; isFile: boolean; size: number; modifiedAt: string; mime: string }
/** Operacje na plikach serwera (Client API Pterodactyla). Ścieżki są już zwalidowane i znormalizowane przez warstwę serwisu. */
export interface FileOps {
  list(s: { externalUuid: string | null }, dir: string): Promise<FileEntry[]>;
  read(s: { externalUuid: string | null }, path: string): Promise<string>;
  write(s: { externalUuid: string | null }, path: string, content: string): Promise<void>;
  mkdir(s: { externalUuid: string | null }, dir: string, name: string): Promise<void>;
  remove(s: { externalUuid: string | null }, dir: string, names: string[]): Promise<void>;
  rename(s: { externalUuid: string | null }, dir: string, from: string, to: string): Promise<void>;
}
/** Prawdziwe kopie zapasowe serwera (Client API Pterodactyla). */
export interface BackupOps {
  create(s: { externalUuid: string | null }, name: string): Promise<{ externalId: string }>;
  /** ready=false i failed=false => kopia jest jeszcze tworzona. */
  status(s: { externalUuid: string | null }, externalId: string): Promise<{ ready: boolean; failed: boolean; sizeMb: number }>;
  remove(s: { externalUuid: string | null }, externalId: string): Promise<void>;
  restore(s: { externalUuid: string | null }, externalId: string): Promise<void>;
}
export interface GameServerAdapter {
  readonly name: string;
  readonly isDemo: boolean;
  /** Kopie zapasowe; brak = tylko rekordy (adapter DEMO). */
  readonly backups?: BackupOps;
  /** Menedżer plików; brak = niedostępny (np. adapter DEMO). */
  readonly files?: FileOps;
  createServer(input: CreateServerInput): Promise<{ externalId: string; externalUuid: string }>;
  /** Zwraca docelowy status po wykonaniu akcji. */
  power(server: { externalId: string | null; externalUuid: string | null; eulaAccepted?: boolean }, action: PowerAction): Promise<ServerStatus>;
  /** Odczyt stanu i zasobów (Client API). null = brak danych. */
  resources?(server: { externalUuid: string | null }): Promise<{ state: ServerStatus; cpu: number; ramMb: number; diskMb: number; netInKb: number; netOutKb: number } | null>;
  /** Zmiana eggu/zmiennych i ponowna instalacja serwera (zmiana silnika/wersji). Brak = niedostępne (DEMO). */
  reinstall?(server: { externalId: string | null }, input: { nestId: number; eggId: number; dockerImage: string | null; envVars: Record<string, string> }): Promise<void>;
  /** Czy serwer jest w trakcie instalacji (Application API). */
  installing?(server: { externalId: string | null }): Promise<boolean>;
  suspend(server: { externalId: string | null }, suspended: boolean): Promise<void>;
  deleteServer(server: { externalId: string | null }): Promise<void>;
}
