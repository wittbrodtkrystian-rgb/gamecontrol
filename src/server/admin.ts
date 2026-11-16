import { z } from "zod";
const plan = {
  name: z.string().trim().min(2).max(40), variant: z.string().trim().max(40).nullable().optional(),
  priceMonthly: z.number().int().min(0).max(10_000_00), ramMb: z.number().int().min(256).max(262144),
  cpuPercent: z.number().int().min(10).max(6400), diskMb: z.number().int().min(512).max(5_000_000),
  slots: z.number().int().min(1).max(1000), available: z.boolean(), sortOrder: z.number().int().min(0).max(1000),
  pterodactylEggId: z.number().int().positive().nullable().optional(), pterodactylNestId: z.number().int().positive().nullable().optional(), dockerImage: z.string().max(200).nullable().optional(),
};
export const planUpdateSchema = z.object(plan).partial().strict();
export const planCreateSchema = z.object({ ...plan, gameId: z.string().min(1), slug: z.string().regex(/^[a-z0-9-]{2,40}$/) }).strict();
const node = { name: z.string().trim().min(2).max(40), fqdn: z.string().trim().max(120), location: z.string().trim().max(60),
  ramTotalMb: z.number().int().min(512), diskTotalMb: z.number().int().min(1024), cpuTotal: z.number().int().min(100),
  enabled: z.boolean(), maintenance: z.boolean(), pterodactylNodeId: z.number().int().positive().nullable().optional() };
export const nodeUpdateSchema = z.object(node).partial().strict();
export const nodeCreateSchema = z.object({ ...node, enabled: node.enabled.default(true), maintenance: node.maintenance.default(false), isDemo: z.boolean().default(false) }).strict();
