import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, floodEventsTable } from "@workspace/db";
import { CreateFloodEventBody, ResolveFloodEventParams, ListFloodEventsQueryParams } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

function serialize(e: typeof floodEventsTable.$inferSelect) {
  return {
    ...e,
    triggeredAt: e.triggeredAt.toISOString(),
    resolvedAt: e.resolvedAt?.toISOString() ?? null,
    createdAt: e.createdAt.toISOString(),
  };
}

function riskLevel(total: number, avgWait: number): "safe" | "caution" | "danger" | "critical" {
  if (total === 0) return "safe";
  if (total <= 2 && avgWait < 60) return "caution";
  if (total <= 5 || avgWait < 300) return "danger";
  return "critical";
}

router.get("/flood-events", async (req, res): Promise<void> => {
  const params = ListFloodEventsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  let query = db.select().from(floodEventsTable).orderBy(desc(floodEventsTable.createdAt)).$dynamic();
  if (params.data.accountId) query = query.where(eq(floodEventsTable.accountId, params.data.accountId));
  const events = await query;
  res.json(events.map(serialize));
});

router.post("/flood-events", async (req, res): Promise<void> => {
  const parsed = CreateFloodEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [ev] = await db.insert(floodEventsTable).values(parsed.data as Parameters<typeof db.insert>[0] extends never ? never : never).returning();
  logger.warn({ accountId: parsed.data.accountId, waitSeconds: parsed.data.waitSeconds }, "FloodWait event recorded");
  res.status(201).json(serialize(ev));
});

router.get("/flood-events/stats", async (_req, res): Promise<void> => {
  const allEvents = await db.select().from(floodEventsTable).orderBy(desc(floodEventsTable.createdAt));
  const byAccount = new Map<number, typeof allEvents>();
  for (const ev of allEvents) {
    if (!byAccount.has(ev.accountId)) byAccount.set(ev.accountId, []);
    byAccount.get(ev.accountId)!.push(ev);
  }
  const stats = Array.from(byAccount.entries()).map(([accountId, events]) => {
    const total = events.length;
    const avgWait = total > 0 ? events.reduce((s, e) => s + e.waitSeconds, 0) / total : 0;
    const last = events[0];
    const recentEvents = events.filter(e => Date.now() - e.createdAt.getTime() < 3600000);
    const predictedNextFlood = recentEvents.length >= 3
      ? new Date(Date.now() + 30 * 60000).toISOString()
      : null;
    return { accountId, totalEvents: total, avgWaitSeconds: Math.round(avgWait), lastEventAt: last?.createdAt.toISOString() ?? null, riskLevel: riskLevel(total, avgWait), predictedNextFlood };
  });
  res.json(stats);
});

router.post("/flood-events/:id/resolve", async (req, res): Promise<void> => {
  const params = ResolveFloodEventParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [ev] = await db.update(floodEventsTable).set({ resolved: true, resolvedAt: new Date() }).where(eq(floodEventsTable.id, params.data.id)).returning();
  if (!ev) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(ev));
});

export default router;
