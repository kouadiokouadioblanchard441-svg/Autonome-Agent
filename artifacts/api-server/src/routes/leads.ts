import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, leadsTable } from "@workspace/db";
import { CreateLeadBody, UpdateLeadBody, UpdateLeadParams, DeleteLeadParams, ListLeadsQueryParams } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

type LeadInsert = typeof leadsTable.$inferInsert;

function serialize(l: typeof leadsTable.$inferSelect) {
  return {
    ...l,
    firstContactAt: l.firstContactAt?.toISOString() ?? null,
    lastContactAt: l.lastContactAt?.toISOString() ?? null,
    conversionAt: l.conversionAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

router.get("/leads", async (req, res): Promise<void> => {
  const params = ListLeadsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  let query = db.select().from(leadsTable).orderBy(leadsTable.updatedAt).$dynamic();
  if (params.data.stage) query = query.where(eq(leadsTable.stage, params.data.stage));
  if (params.data.accountId) query = query.where(eq(leadsTable.accountId, params.data.accountId));
  const leads = await query;
  res.json(leads.map(serialize));
});

router.get("/leads/stats", async (_req, res): Promise<void> => {
  const all = await db.select().from(leadsTable);
  const stages = ["cold", "contacted", "interested", "negotiating", "converted", "lost"];
  const counts: Record<string, number> = Object.fromEntries(stages.map(s => [s, 0]));
  for (const l of all) counts[l.stage] = (counts[l.stage] ?? 0) + 1;
  const total = all.length;
  const conversionRate = total > 0 ? (counts.converted / total) * 100 : 0;
  res.json({ ...counts, total, conversionRate: Math.round(conversionRate * 10) / 10 });
});

router.post("/leads", async (req, res): Promise<void> => {
  const parsed = CreateLeadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data: LeadInsert = { ...(parsed.data as unknown as LeadInsert), firstContactAt: new Date(), lastContactAt: new Date() };
  const [lead] = await db.insert(leadsTable).values(data).returning();
  logger.info({ leadId: lead.id }, "Lead created");
  res.status(201).json(serialize(lead));
});

router.patch("/leads/:id", async (req, res): Promise<void> => {
  const params = UpdateLeadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateLeadBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const extra: Partial<LeadInsert> = { updatedAt: new Date(), lastContactAt: new Date() };
  if (parsed.data.stage === "converted") extra.conversionAt = new Date();
  const [lead] = await db.update(leadsTable).set({ ...(parsed.data as unknown as Partial<LeadInsert>), ...extra }).where(eq(leadsTable.id, params.data.id)).returning();
  if (!lead) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(lead));
});

router.delete("/leads/:id", async (req, res): Promise<void> => {
  const params = DeleteLeadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(leadsTable).where(eq(leadsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
