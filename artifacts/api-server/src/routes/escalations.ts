import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, escalationsTable } from "@workspace/db";
import { CreateEscalationBody, UpdateEscalationBody, UpdateEscalationParams, DeleteEscalationParams, ListEscalationsQueryParams } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

type EscalationInsert = typeof escalationsTable.$inferInsert;

function serialize(e: typeof escalationsTable.$inferSelect) {
  return {
    ...e,
    createdAt: e.createdAt.toISOString(),
    resolvedAt: e.resolvedAt?.toISOString() ?? null,
  };
}

router.get("/escalations", async (req, res): Promise<void> => {
  const params = ListEscalationsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  let query = db.select().from(escalationsTable).orderBy(escalationsTable.createdAt).$dynamic();
  if (params.data.status) query = query.where(eq(escalationsTable.status, params.data.status));
  const escalations = await query;
  res.json(escalations.map(serialize));
});

router.post("/escalations", async (req, res): Promise<void> => {
  const parsed = CreateEscalationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [esc] = await db.insert(escalationsTable).values(parsed.data as unknown as EscalationInsert).returning();
  logger.warn({ escId: esc.id, accountId: esc.accountId, reason: esc.reason }, "Escalation created");
  res.status(201).json(serialize(esc));
});

router.patch("/escalations/:id", async (req, res): Promise<void> => {
  const params = UpdateEscalationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateEscalationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const extra: Partial<EscalationInsert> = {};
  if (parsed.data.status === "resolved" || parsed.data.status === "ignored") extra.resolvedAt = new Date();
  const [esc] = await db.update(escalationsTable).set({ ...(parsed.data as unknown as Partial<EscalationInsert>), ...extra }).where(eq(escalationsTable.id, params.data.id)).returning();
  if (!esc) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(esc));
});

router.delete("/escalations/:id", async (req, res): Promise<void> => {
  const params = DeleteEscalationParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(escalationsTable).where(eq(escalationsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
