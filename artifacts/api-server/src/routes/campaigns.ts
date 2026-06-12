import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, campaignsTable } from "@workspace/db";
import {
  CreateCampaignBody,
  UpdateCampaignBody,
  UpdateCampaignParams,
  GetCampaignParams,
  DeleteCampaignParams,
  StartCampaignParams,
  StopCampaignParams,
} from "@workspace/api-zod";

const router = Router();

function serializeCampaign(c: typeof campaignsTable.$inferSelect) {
  return {
    ...c,
    targetGroups: JSON.parse(c.targetGroups || "[]"),
    targetChannels: JSON.parse(c.targetChannels || "[]"),
    startDate: c.startDate?.toISOString() ?? null,
    endDate: c.endDate?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/campaigns", async (_req, res): Promise<void> => {
  const campaigns = await db.select().from(campaignsTable).orderBy(campaignsTable.createdAt);
  res.json(campaigns.map(serializeCampaign));
});

router.post("/campaigns", async (req, res): Promise<void> => {
  const parsed = CreateCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { targetGroups, targetChannels, startDate, endDate, ...rest } = parsed.data;
  const [campaign] = await db.insert(campaignsTable).values({
    ...rest,
    targetGroups: JSON.stringify(targetGroups ?? []),
    targetChannels: JSON.stringify(targetChannels ?? []),
    startDate: startDate ? new Date(startDate) : undefined,
    endDate: endDate ? new Date(endDate) : undefined,
  }).returning();
  res.status(201).json(serializeCampaign(campaign));
});

router.get("/campaigns/:id", async (req, res): Promise<void> => {
  const params = GetCampaignParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [campaign] = await db.select().from(campaignsTable).where(eq(campaignsTable.id, params.data.id));
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(serializeCampaign(campaign));
});

router.patch("/campaigns/:id", async (req, res): Promise<void> => {
  const params = UpdateCampaignParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateCampaignBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { startDate: sd, endDate: ed, ...updateRest } = parsed.data;
  const [campaign] = await db.update(campaignsTable).set({
    ...updateRest,
    ...(sd !== undefined ? { startDate: sd ? new Date(sd) : null } : {}),
    ...(ed !== undefined ? { endDate: ed ? new Date(ed) : null } : {}),
  }).where(eq(campaignsTable.id, params.data.id)).returning();
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(serializeCampaign(campaign));
});

router.delete("/campaigns/:id", async (req, res): Promise<void> => {
  const params = DeleteCampaignParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(campaignsTable).where(eq(campaignsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/campaigns/:id/start", async (req, res): Promise<void> => {
  const params = StartCampaignParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [campaign] = await db.update(campaignsTable).set({ status: "active" }).where(eq(campaignsTable.id, params.data.id)).returning();
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(serializeCampaign(campaign));
});

router.post("/campaigns/:id/stop", async (req, res): Promise<void> => {
  const params = StopCampaignParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [campaign] = await db.update(campaignsTable).set({ status: "paused" }).where(eq(campaignsTable.id, params.data.id)).returning();
  if (!campaign) { res.status(404).json({ error: "Campaign not found" }); return; }
  res.json(serializeCampaign(campaign));
});

export default router;
