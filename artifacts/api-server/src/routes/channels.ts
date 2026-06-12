import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, telegramChannelsTable } from "@workspace/db";
import {
  CreateChannelBody,
  UpdateChannelBody,
  UpdateChannelParams,
  GetChannelParams,
  DeleteChannelParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/channels", async (_req, res): Promise<void> => {
  const channels = await db.select().from(telegramChannelsTable).orderBy(telegramChannelsTable.createdAt);
  res.json(channels.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() })));
});

router.post("/channels", async (req, res): Promise<void> => {
  const parsed = CreateChannelBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [channel] = await db.insert(telegramChannelsTable).values(parsed.data).returning();
  res.status(201).json({ ...channel, createdAt: channel.createdAt.toISOString() });
});

router.get("/channels/:id", async (req, res): Promise<void> => {
  const params = GetChannelParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [channel] = await db.select().from(telegramChannelsTable).where(eq(telegramChannelsTable.id, params.data.id));
  if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }
  res.json({ ...channel, createdAt: channel.createdAt.toISOString() });
});

router.patch("/channels/:id", async (req, res): Promise<void> => {
  const params = UpdateChannelParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateChannelBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [channel] = await db.update(telegramChannelsTable).set(parsed.data).where(eq(telegramChannelsTable.id, params.data.id)).returning();
  if (!channel) { res.status(404).json({ error: "Channel not found" }); return; }
  res.json({ ...channel, createdAt: channel.createdAt.toISOString() });
});

router.delete("/channels/:id", async (req, res): Promise<void> => {
  const params = DeleteChannelParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(telegramChannelsTable).where(eq(telegramChannelsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
