import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, securityLogsTable, sanctionsTable } from "@workspace/db";
import { CreateSanctionBody, DeleteSanctionParams } from "@workspace/api-zod";

const router = Router();

router.get("/security/logs", async (_req, res): Promise<void> => {
  const logs = await db.select().from(securityLogsTable).orderBy(desc(securityLogsTable.createdAt)).limit(100);
  res.json(logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })));
});

router.get("/security/sanctions", async (_req, res): Promise<void> => {
  const sanctions = await db.select().from(sanctionsTable).orderBy(desc(sanctionsTable.createdAt));
  res.json(sanctions.map((s) => ({
    ...s,
    expiresAt: s.expiresAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  })));
});

router.post("/security/sanctions", async (req, res): Promise<void> => {
  const parsed = CreateSanctionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { expiresAt, ...rest } = parsed.data;
  const [sanction] = await db.insert(sanctionsTable).values({
    ...rest,
    expiresAt: expiresAt ? new Date(expiresAt) : undefined,
  }).returning();
  res.status(201).json({
    ...sanction,
    expiresAt: sanction.expiresAt?.toISOString() ?? null,
    createdAt: sanction.createdAt.toISOString(),
  });
});

router.delete("/security/sanctions/:id", async (req, res): Promise<void> => {
  const params = DeleteSanctionParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(sanctionsTable).where(eq(sanctionsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/security/stats", async (_req, res): Promise<void> => {
  const logs = await db.select().from(securityLogsTable);
  const sanctions = await db.select().from(sanctionsTable);
  res.json({
    threatsDetected: logs.length,
    spamBlocked: logs.filter((l) => l.eventType === "spam_detected").length,
    usersWarned: sanctions.filter((s) => s.type === "warn").length,
    usersBanned: sanctions.filter((s) => s.type === "ban").length,
    usersMuted: sanctions.filter((s) => s.type === "mute").length,
    phishingBlocked: logs.filter((l) => l.eventType === "phishing").length,
    scamsDetected: logs.filter((l) => l.eventType === "scam").length,
  });
});

export default router;
