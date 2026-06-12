import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { MarkNotificationReadParams } from "@workspace/api-zod";

const router = Router();

router.get("/notifications", async (_req, res): Promise<void> => {
  const notifications = await db.select().from(notificationsTable).orderBy(desc(notificationsTable.createdAt)).limit(50);
  res.json(notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() })));
});

router.patch("/notifications/:id/read", async (req, res): Promise<void> => {
  const params = MarkNotificationReadParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [notif] = await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.id, params.data.id)).returning();
  if (!notif) { res.status(404).json({ error: "Notification not found" }); return; }
  res.json({ ...notif, createdAt: notif.createdAt.toISOString() });
});

export default router;
