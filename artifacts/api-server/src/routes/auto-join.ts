import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, autoJoinTargetsTable } from "@workspace/db";
import { CreateAutoJoinTargetBody, UpdateAutoJoinTargetBody, UpdateAutoJoinTargetParams, DeleteAutoJoinTargetParams } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

type AutoJoinInsert = typeof autoJoinTargetsTable.$inferInsert;

function serialize(t: typeof autoJoinTargetsTable.$inferSelect) {
  return {
    ...t,
    lastScanAt: t.lastScanAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

router.get("/auto-join", async (_req, res): Promise<void> => {
  const targets = await db.select().from(autoJoinTargetsTable).orderBy(autoJoinTargetsTable.createdAt);
  res.json(targets.map(serialize));
});

router.post("/auto-join", async (req, res): Promise<void> => {
  const parsed = CreateAutoJoinTargetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [target] = await db.insert(autoJoinTargetsTable).values(parsed.data as unknown as AutoJoinInsert).returning();
  logger.info({ targetId: target.id }, "Auto-join target created");
  res.status(201).json(serialize(target));
});

router.patch("/auto-join/:id", async (req, res): Promise<void> => {
  const params = UpdateAutoJoinTargetParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateAutoJoinTargetBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [target] = await db.update(autoJoinTargetsTable).set(parsed.data as unknown as Partial<AutoJoinInsert>).where(eq(autoJoinTargetsTable.id, params.data.id)).returning();
  if (!target) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(target));
});

router.delete("/auto-join/:id", async (req, res): Promise<void> => {
  const params = DeleteAutoJoinTargetParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(autoJoinTargetsTable).where(eq(autoJoinTargetsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
