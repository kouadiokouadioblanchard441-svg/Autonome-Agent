import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, schedulesTable } from "@workspace/db";
import {
  CreateScheduleBody,
  UpdateScheduleBody,
  UpdateScheduleParams,
  GetScheduleParams,
  DeleteScheduleParams,
} from "@workspace/api-zod";

const router = Router();

function serializeSchedule(s: typeof schedulesTable.$inferSelect) {
  return {
    ...s,
    lastRun: s.lastRun?.toISOString() ?? null,
    nextRun: s.nextRun?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  };
}

router.get("/schedules", async (_req, res): Promise<void> => {
  const schedules = await db.select().from(schedulesTable).orderBy(schedulesTable.createdAt);
  res.json(schedules.map(serializeSchedule));
});

router.post("/schedules", async (req, res): Promise<void> => {
  const parsed = CreateScheduleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [schedule] = await db.insert(schedulesTable).values(parsed.data).returning();
  res.status(201).json(serializeSchedule(schedule));
});

router.get("/schedules/:id", async (req, res): Promise<void> => {
  const params = GetScheduleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [schedule] = await db.select().from(schedulesTable).where(eq(schedulesTable.id, params.data.id));
  if (!schedule) { res.status(404).json({ error: "Schedule not found" }); return; }
  res.json(serializeSchedule(schedule));
});

router.patch("/schedules/:id", async (req, res): Promise<void> => {
  const params = UpdateScheduleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateScheduleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [schedule] = await db.update(schedulesTable).set(parsed.data).where(eq(schedulesTable.id, params.data.id)).returning();
  if (!schedule) { res.status(404).json({ error: "Schedule not found" }); return; }
  res.json(serializeSchedule(schedule));
});

router.delete("/schedules/:id", async (req, res): Promise<void> => {
  const params = DeleteScheduleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(schedulesTable).where(eq(schedulesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
