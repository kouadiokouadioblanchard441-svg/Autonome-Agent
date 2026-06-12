import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, telegramGroupsTable } from "@workspace/db";
import {
  CreateGroupBody,
  UpdateGroupBody,
  UpdateGroupParams,
  GetGroupParams,
  DeleteGroupParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/groups", async (_req, res): Promise<void> => {
  const groups = await db.select().from(telegramGroupsTable).orderBy(telegramGroupsTable.createdAt);
  res.json(groups.map((g) => ({ ...g, createdAt: g.createdAt.toISOString() })));
});

router.post("/groups", async (req, res): Promise<void> => {
  const parsed = CreateGroupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [group] = await db.insert(telegramGroupsTable).values(parsed.data).returning();
  res.status(201).json({ ...group, createdAt: group.createdAt.toISOString() });
});

router.get("/groups/:id", async (req, res): Promise<void> => {
  const params = GetGroupParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [group] = await db.select().from(telegramGroupsTable).where(eq(telegramGroupsTable.id, params.data.id));
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }
  res.json({ ...group, createdAt: group.createdAt.toISOString() });
});

router.patch("/groups/:id", async (req, res): Promise<void> => {
  const params = UpdateGroupParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateGroupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [group] = await db.update(telegramGroupsTable).set(parsed.data).where(eq(telegramGroupsTable.id, params.data.id)).returning();
  if (!group) { res.status(404).json({ error: "Group not found" }); return; }
  res.json({ ...group, createdAt: group.createdAt.toISOString() });
});

router.delete("/groups/:id", async (req, res): Promise<void> => {
  const params = DeleteGroupParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(telegramGroupsTable).where(eq(telegramGroupsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
