import { Router } from "express";
import { eq, isNull } from "drizzle-orm";
import { db, delayConfigsTable } from "@workspace/db";
import {
  CreateDelayConfigBody,
  UpdateDelayConfigBody,
  UpdateDelayConfigParams,
  GetDelayConfigParams,
  DeleteDelayConfigParams,
  GetAccountActivityStatusParams,
  PreviewDelayTimingBody,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

function serialize(c: typeof delayConfigsTable.$inferSelect) {
  return { ...c, createdAt: c.createdAt.toISOString() };
}

// ── List all configs ───────────────────────────────────────────────────────────
router.get("/delay-config", async (_req, res): Promise<void> => {
  const configs = await db.select().from(delayConfigsTable).orderBy(delayConfigsTable.createdAt);
  res.json(configs.map(serialize));
});

// ── Get global config ──────────────────────────────────────────────────────────
router.get("/delay-config/global", async (_req, res): Promise<void> => {
  const [config] = await db.select().from(delayConfigsTable)
    .where(eq(delayConfigsTable.isGlobal, true));
  if (!config) {
    // Return defaults if none exists
    res.json({
      id: 0, name: "Default Global", isGlobal: true, accountId: null, groupId: null,
      minReplyDelay: 10, maxReplyDelay: 180, typingEnabled: true, typingSpeed: "human",
      onlineSimulation: true, nightSlowMode: true, randomBreaks: true,
      readingSimulation: true, readingSpeedWpm: 220, priorityUsers: "[]",
      priorityMultiplier: 0.3, nightMultiplier: 3.0, nightStartHour: 23, nightEndHour: 7,
      breakProbability: 0.05, breakMinDuration: 300, breakMaxDuration: 1800,
      activeHoursStart: 8, activeHoursEnd: 23, contextAdaptation: true,
      activePeriods: "[[8,12],[13,17],[18,22]]", cooldownMinutes: 30,
      maxContinuousActiveMinutes: 120, createdAt: new Date().toISOString(),
    });
    return;
  }
  res.json(serialize(config));
});

// ── Preview timing (no sleep) ──────────────────────────────────────────────────
router.post("/delay-config/preview", async (req, res): Promise<void> => {
  const parsed = PreviewDelayTimingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const cfg = parsed.data;
  const msg = cfg.sampleMessage ?? "Hello, how are you doing today? I wanted to ask about the latest updates.";

  // Reading time simulation
  const wordCount = msg.split(/\s+/).length;
  const wpm = cfg.readingSpeedWpm ?? 220;
  const readingDelay = cfg.readingSimulation !== false
    ? Math.max(0.5, (wordCount / wpm) * 60 + (wordCount > 20 ? 1 : 0.5))
    : 0;

  // Base response delay (beta distribution center)
  const min = cfg.minReplyDelay;
  const max = cfg.maxReplyDelay;
  const baseDelay = min + (max - min) * 0.28; // beta(2,5) mean ≈ 0.28

  // Night mode
  const hour = new Date().getHours();
  const nightStart = 23, nightEnd = 7;
  const isNight = hour >= nightStart || hour < nightEnd;
  const nightMult = cfg.nightSlowMode !== false ? (cfg.nightMultiplier ?? 3.0) : 1.0;
  const effectiveDelay = isNight ? baseDelay * nightMult : baseDelay;

  // Typing durations by message category
  function typingDuration(chars: number): number {
    const cpmMap: Record<string, [number, number]> = {
      slow: [80, 120], human: [150, 280], fast: [300, 450], variable: [150, 350],
    };
    const [cMin, cMax] = cpmMap[cfg.typingSpeed ?? "human"] ?? [150, 280];
    const cpm = (cMin + cMax) / 2;
    const base = (chars / cpm) * 60;
    return Math.max(chars < 50 ? 2 : chars < 200 ? 5 : 15, Math.min(90, base));
  }

  res.json({
    readingDelaySeconds: Math.round(readingDelay * 100) / 100,
    baseResponseDelaySeconds: Math.round(baseDelay * 100) / 100,
    typingShortMessageSeconds: Math.round(typingDuration(15) * 100) / 100,
    typingMediumMessageSeconds: Math.round(typingDuration(80) * 100) / 100,
    typingLongMessageSeconds: Math.round(typingDuration(300) * 100) / 100,
    totalEstimatedSeconds: Math.round((readingDelay + effectiveDelay) * 100) / 100,
    nightModeWouldApply: isNight && (cfg.nightSlowMode !== false),
    effectiveMaxDelay: Math.round(effectiveDelay * 100) / 100,
  });
});

// ── Activity status (simulated without Python engine connection) ────────────────
router.get("/delay-config/activity/:accountId", async (req, res): Promise<void> => {
  const params = GetAccountActivityStatusParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }

  const hour = new Date().getHours();
  const isNight = hour >= 23 || hour < 7;
  const inActivePeriod = hour >= 8 && hour < 23;

  const states = ["active", "idle", "active", "active", "idle"] as const;
  const state = isNight ? "sleep" : states[params.data.accountId % states.length];
  const onBreak = false;

  res.json({
    state,
    inActivePeriod,
    onBreak,
    breakRemainingSeconds: 0,
    sessionActiveMinutes: Math.round(Math.random() * 60 + 10),
    lastActivitySecondsAgo: Math.round(Math.random() * 300),
  });
});

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.post("/delay-config", async (req, res): Promise<void> => {
  const parsed = CreateDelayConfigBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  // If global, unset any existing global
  if (parsed.data.isGlobal) {
    await db.update(delayConfigsTable).set({ isGlobal: false })
      .where(eq(delayConfigsTable.isGlobal, true));
  }

  const [config] = await db.insert(delayConfigsTable).values(parsed.data).returning();
  logger.info({ configId: config.id }, "Delay config created");
  res.status(201).json(serialize(config));
});

router.get("/delay-config/:id", async (req, res): Promise<void> => {
  const params = GetDelayConfigParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [config] = await db.select().from(delayConfigsTable).where(eq(delayConfigsTable.id, params.data.id));
  if (!config) { res.status(404).json({ error: "Config not found" }); return; }
  res.json(serialize(config));
});

router.patch("/delay-config/:id", async (req, res): Promise<void> => {
  const params = UpdateDelayConfigParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateDelayConfigBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  if (parsed.data.isGlobal) {
    await db.update(delayConfigsTable).set({ isGlobal: false })
      .where(eq(delayConfigsTable.isGlobal, true));
  }

  const [config] = await db.update(delayConfigsTable).set(parsed.data)
    .where(eq(delayConfigsTable.id, params.data.id)).returning();
  if (!config) { res.status(404).json({ error: "Config not found" }); return; }
  res.json(serialize(config));
});

router.delete("/delay-config/:id", async (req, res): Promise<void> => {
  const params = DeleteDelayConfigParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(delayConfigsTable).where(eq(delayConfigsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
