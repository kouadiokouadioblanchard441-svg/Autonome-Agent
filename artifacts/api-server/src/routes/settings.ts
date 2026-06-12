import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, appSettingsTable } from "@workspace/db";
import { UpsertSettingsBody, GetSettingParams, DeleteSettingParams } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

function mask(s: typeof appSettingsTable.$inferSelect) {
  if (!s.isSecret || !s.value) return { ...s, updatedAt: s.updatedAt.toISOString() };
  const v = s.value;
  const masked = v.length <= 8 ? "••••••••" : v.slice(0, 4) + "••••••••" + v.slice(-4);
  return { ...s, value: masked, updatedAt: s.updatedAt.toISOString() };
}

// ── List all (secrets masked) ────────────────────────────────────────────────
router.get("/settings", async (_req, res): Promise<void> => {
  const settings = await db.select().from(appSettingsTable).orderBy(appSettingsTable.key);
  res.json(settings.map(mask));
});

// ── Get one (unmasked) ────────────────────────────────────────────────────────
router.get("/settings/:key", async (req, res): Promise<void> => {
  const params = GetSettingParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [s] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, params.data.key));
  if (!s) { res.status(404).json({ error: "Setting not found" }); return; }
  res.json({ key: s.key, value: s.value });
});

// ── Upsert many ───────────────────────────────────────────────────────────────
router.put("/settings", async (req, res): Promise<void> => {
  const parsed = UpsertSettingsBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const results = [];
  for (const item of parsed.data.settings) {
    const [existing] = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, item.key));
    if (existing) {
      const [updated] = await db.update(appSettingsTable)
        .set({ value: item.value, isSecret: item.isSecret, description: item.description ?? existing.description, updatedAt: new Date() })
        .where(eq(appSettingsTable.key, item.key))
        .returning();
      results.push(updated);
    } else {
      const [inserted] = await db.insert(appSettingsTable)
        .values({ key: item.key, value: item.value, isSecret: item.isSecret, description: item.description ?? null })
        .returning();
      results.push(inserted);
    }
  }

  logger.info({ count: results.length }, "Settings upserted");
  res.json(results.map(mask));
});

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete("/settings/:key", async (req, res): Promise<void> => {
  const params = DeleteSettingParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(appSettingsTable).where(eq(appSettingsTable.key, params.data.key));
  res.sendStatus(204);
});

export default router;
