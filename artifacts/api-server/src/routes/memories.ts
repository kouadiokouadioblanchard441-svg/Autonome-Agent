import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, conversationMemoriesTable } from "@workspace/db";
import { CreateMemoryBody, UpdateMemoryBody, UpdateMemoryParams, DeleteMemoryParams, ListMemoriesQueryParams } from "@workspace/api-zod";

const router = Router();

type MemoryInsert = typeof conversationMemoriesTable.$inferInsert;

function serialize(m: typeof conversationMemoriesTable.$inferSelect) {
  return {
    ...m,
    lastMessageAt: m.lastMessageAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

router.get("/memories", async (req, res): Promise<void> => {
  const params = ListMemoriesQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  let query = db.select().from(conversationMemoriesTable).orderBy(conversationMemoriesTable.updatedAt).$dynamic();
  if (params.data.accountId) query = query.where(eq(conversationMemoriesTable.accountId, params.data.accountId));
  if (params.data.interestLevel) query = query.where(eq(conversationMemoriesTable.interestLevel, params.data.interestLevel));
  const mems = await query;
  res.json(mems.map(serialize));
});

router.post("/memories", async (req, res): Promise<void> => {
  const parsed = CreateMemoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data as unknown as MemoryInsert;
  const [mem] = await db.insert(conversationMemoriesTable).values(data).returning();
  res.status(201).json(serialize(mem));
});

router.patch("/memories/:id", async (req, res): Promise<void> => {
  const params = UpdateMemoryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateMemoryBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [mem] = await db.update(conversationMemoriesTable).set({ ...(parsed.data as unknown as Partial<MemoryInsert>), updatedAt: new Date() }).where(eq(conversationMemoriesTable.id, params.data.id)).returning();
  if (!mem) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(mem));
});

router.delete("/memories/:id", async (req, res): Promise<void> => {
  const params = DeleteMemoryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(conversationMemoriesTable).where(eq(conversationMemoriesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
