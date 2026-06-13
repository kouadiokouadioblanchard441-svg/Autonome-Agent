import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, warmupPlansTable } from "@workspace/db";
import { CreateWarmupPlanBody, UpdateWarmupPlanBody, UpdateWarmupPlanParams, DeleteWarmupPlanParams, AdvanceWarmupDayParams } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

type WarmupInsert = typeof warmupPlansTable.$inferInsert;

function serialize(p: typeof warmupPlansTable.$inferSelect) {
  return {
    ...p,
    startDate: p.startDate?.toISOString() ?? null,
    lastActivityAt: p.lastActivityAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

function calcTodayLimit(plan: { currentDay: number; totalDays: number; dailyLimitStart: number; dailyLimitEnd: number; growthType: string }) {
  const progress = plan.totalDays > 1 ? plan.currentDay / (plan.totalDays - 1) : 1;
  if (plan.growthType === "exponential") {
    const factor = Math.pow(plan.dailyLimitEnd / Math.max(plan.dailyLimitStart, 1), progress);
    return Math.round(plan.dailyLimitStart * factor);
  }
  return Math.round(plan.dailyLimitStart + (plan.dailyLimitEnd - plan.dailyLimitStart) * progress);
}

router.get("/warmup", async (_req, res): Promise<void> => {
  const plans = await db.select().from(warmupPlansTable).orderBy(warmupPlansTable.createdAt);
  res.json(plans.map(serialize));
});

router.post("/warmup", async (req, res): Promise<void> => {
  const parsed = CreateWarmupPlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  const todayLimit = calcTodayLimit({ currentDay: 0, totalDays: data.totalDays ?? 14, dailyLimitStart: data.dailyLimitStart ?? 1, dailyLimitEnd: data.dailyLimitEnd ?? 50, growthType: data.growthType ?? "linear" });
  const insert: WarmupInsert = { ...(data as unknown as WarmupInsert), todayLimit };
  const [plan] = await db.insert(warmupPlansTable).values(insert).returning();
  logger.info({ planId: plan.id }, "Warmup plan created");
  res.status(201).json(serialize(plan));
});

router.patch("/warmup/:id", async (req, res): Promise<void> => {
  const params = UpdateWarmupPlanParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateWarmupPlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [plan] = await db.update(warmupPlansTable).set(parsed.data as unknown as Partial<WarmupInsert>).where(eq(warmupPlansTable.id, params.data.id)).returning();
  if (!plan) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(plan));
});

router.delete("/warmup/:id", async (req, res): Promise<void> => {
  const params = DeleteWarmupPlanParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(warmupPlansTable).where(eq(warmupPlansTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/warmup/:id/advance", async (req, res): Promise<void> => {
  const params = AdvanceWarmupDayParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [existing] = await db.select().from(warmupPlansTable).where(eq(warmupPlansTable.id, params.data.id));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }
  const nextDay = Math.min(existing.currentDay + 1, existing.totalDays);
  const todayLimit = calcTodayLimit({ ...existing, currentDay: nextDay });
  const status = nextDay >= existing.totalDays ? "completed" : "active";
  const [plan] = await db.update(warmupPlansTable).set({ currentDay: nextDay, todayLimit, todayCount: 0, status, lastActivityAt: new Date() }).where(eq(warmupPlansTable.id, params.data.id)).returning();
  res.json(serialize(plan));
});

export default router;
