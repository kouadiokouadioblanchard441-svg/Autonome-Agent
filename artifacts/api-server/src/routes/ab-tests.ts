import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, abTestsTable } from "@workspace/db";
import { CreateAbTestBody, UpdateAbTestBody, UpdateAbTestParams, DeleteAbTestParams, StartAbTestParams, RecordAbTestReplyParams, RecordAbTestReplyBody } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

type AbTestInsert = typeof abTestsTable.$inferInsert;

function serialize(t: typeof abTestsTable.$inferSelect) {
  return {
    ...t,
    reactionsA: t.reactionsA ?? 0,
    reactionsB: t.reactionsB ?? 0,
    promptMode: t.promptMode ?? 0,
    communityType: t.communityType ?? null,
    communityId: t.communityId ?? null,
    lastVariantSent: t.lastVariantSent ?? null,
    startedAt: t.startedAt?.toISOString() ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
  };
}

function calcRates(test: typeof abTestsTable.$inferSelect) {
  const rateA = test.sentA > 0 ? test.repliesA / test.sentA : 0;
  const rateB = test.sentB > 0 ? test.repliesB / test.sentB : 0;
  return { replyRateA: Math.round(rateA * 1000) / 1000, replyRateB: Math.round(rateB * 1000) / 1000 };
}

function detectWinner(test: typeof abTestsTable.$inferSelect): string | null {
  const minSent = Math.min(test.sentA, test.sentB);
  if (minSent < 20) return null;
  const diff = Math.abs(test.replyRateA - test.replyRateB);
  if (diff < 0.05) return null;
  return test.replyRateA > test.replyRateB ? "a" : "b";
}

router.get("/ab-tests", async (_req, res): Promise<void> => {
  const tests = await db.select().from(abTestsTable).orderBy(abTestsTable.createdAt);
  res.json(tests.map(serialize));
});

router.post("/ab-tests", async (req, res): Promise<void> => {
  const parsed = CreateAbTestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [test] = await db.insert(abTestsTable).values(parsed.data as unknown as AbTestInsert).returning();
  res.status(201).json(serialize(test));
});

router.patch("/ab-tests/:id", async (req, res): Promise<void> => {
  const params = UpdateAbTestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateAbTestBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [test] = await db.update(abTestsTable).set(parsed.data as unknown as Partial<AbTestInsert>).where(eq(abTestsTable.id, params.data.id)).returning();
  if (!test) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(test));
});

router.delete("/ab-tests/:id", async (req, res): Promise<void> => {
  const params = DeleteAbTestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(abTestsTable).where(eq(abTestsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/ab-tests/:id/start", async (req, res): Promise<void> => {
  const params = StartAbTestParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [test] = await db.update(abTestsTable).set({ status: "active", startedAt: new Date() }).where(eq(abTestsTable.id, params.data.id)).returning();
  if (!test) { res.status(404).json({ error: "Not found" }); return; }
  logger.info({ testId: test.id }, "A/B test started");
  res.json(serialize(test));
});

router.post("/ab-tests/:id/record", async (req, res): Promise<void> => {
  const params = RecordAbTestReplyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = RecordAbTestReplyBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }
  const [existing] = await db.select().from(abTestsTable).where(eq(abTestsTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const update = body.data.variant === "a"
    ? { repliesA: existing.repliesA + 1 }
    : { repliesB: existing.repliesB + 1 };
  const [updated] = await db.update(abTestsTable).set(update).where(eq(abTestsTable.id, params.data.id)).returning();
  const rates = calcRates(updated);
  const winner = detectWinner({ ...updated, ...rates });
  const final = winner && updated.autoSelectWinner
    ? await db.update(abTestsTable).set({ ...rates, winnerVariant: winner, status: "completed", completedAt: new Date() }).where(eq(abTestsTable.id, params.data.id)).returning().then(r => r[0])
    : await db.update(abTestsTable).set(rates).where(eq(abTestsTable.id, params.data.id)).returning().then(r => r[0]);
  res.json(serialize(final));
});

export default router;
