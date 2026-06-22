import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, appSettingsTable } from "@workspace/db";
import { UpsertSettingsBody, GetSettingParams, DeleteSettingParams } from "@workspace/api-zod";
import { logger } from "../lib/logger";

// Known env vars and what they do
const ENV_VAR_CATALOG: Record<string, { label: string; description: string; isSecret: boolean; howTo?: string }> = {
  TELEGRAM_API_ID:         { label: "Telegram API ID",        isSecret: false, description: "Identifiant numérique de ton application Telegram (my.telegram.org)" },
  TELEGRAM_API_HASH:       { label: "Telegram API Hash",      isSecret: true,  description: "Clé secrète de ton application Telegram (my.telegram.org)" },
  TELEGRAM_BOT_TOKEN:      { label: "Bot Token",              isSecret: true,  description: "Token du bot Telegram (obtenu via @BotFather)" },
  ADMIN_TELEGRAM_ID:       { label: "Admin Telegram ID",      isSecret: false, description: "Ton identifiant Telegram numérique — seul toi peux contrôler le bot" },
  OPENAI_API_KEY:          { label: "OpenAI API Key",         isSecret: true,  description: "Clé d'accès GPT-4o (platform.openai.com)", howTo: "platform.openai.com → API Keys" },
  GEMINI_API_KEY:          { label: "Gemini API Key",         isSecret: true,  description: "Clé Google AI Studio — fallback si OpenAI échoue (aistudio.google.com)", howTo: "aistudio.google.com → Get API key" },
  SUPABASE_DATABASE_URL:   { label: "Database URL (Supabase)", isSecret: true, description: "URL de connexion directe PostgreSQL via pgBouncer (Settings → Database → Connection string)" },
};

const router = Router();

function mask(s: typeof appSettingsTable.$inferSelect) {
  if (!s.isSecret || !s.value) return { ...s, updatedAt: s.updatedAt.toISOString() };
  const v = s.value;
  const masked = v.length <= 8 ? "••••••••" : v.slice(0, 4) + "••••••••" + v.slice(-4);
  return { ...s, value: masked, updatedAt: s.updatedAt.toISOString() };
}

// ── Env-var status check (no values exposed, just boolean configured/missing) ─
router.get("/settings/env-status", (_req, res): void => {
  const status = Object.entries(ENV_VAR_CATALOG).map(([key, meta]) => {
    const val = process.env[key];
    return {
      key,
      label: meta.label,
      description: meta.description,
      isSecret: meta.isSecret,
      howTo: meta.howTo ?? null,
      configured: !!(val && val.trim().length > 0),
      source: "env" as const,
    };
  });
  res.json(status);
});

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
