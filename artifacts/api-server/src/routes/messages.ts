import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, messagesTable } from "@workspace/db";
import { SendMessageBody, ListMessagesQueryParams } from "@workspace/api-zod";

const router = Router();

router.get("/messages", async (req, res): Promise<void> => {
  const params = ListMessagesQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  let query = db.select().from(messagesTable).orderBy(desc(messagesTable.createdAt)).$dynamic();
  if (params.data.limit) {
    query = query.limit(params.data.limit);
  }
  const msgs = await query;
  res.json(msgs.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })));
});

router.post("/messages", async (req, res): Promise<void> => {
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [msg] = await db.insert(messagesTable).values({
    ...parsed.data,
    direction: "outbound",
    status: "sent",
    isAIGenerated: parsed.data.useAI ?? false,
  }).returning();
  res.status(201).json({ ...msg, createdAt: msg.createdAt.toISOString() });
});

router.get("/messages/recent", async (_req, res): Promise<void> => {
  const msgs = await db.select().from(messagesTable).orderBy(desc(messagesTable.createdAt)).limit(20);
  res.json(msgs.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })));
});

export default router;
