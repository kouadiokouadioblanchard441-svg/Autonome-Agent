import { Router } from "express";
import { eq, desc } from "drizzle-orm";
import { db, aiPersonalitiesTable, aiLogsTable } from "@workspace/db";
import {
  CreatePersonalityBody,
  UpdatePersonalityBody,
  UpdatePersonalityParams,
  DeletePersonalityParams,
  GenerateContentBody,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

// ── Personalities ──────────────────────────────────────
router.get("/ai/personalities", async (_req, res): Promise<void> => {
  const personalities = await db.select().from(aiPersonalitiesTable).orderBy(aiPersonalitiesTable.createdAt);
  res.json(personalities.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })));
});

router.post("/ai/personalities", async (req, res): Promise<void> => {
  const parsed = CreatePersonalityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [personality] = await db.insert(aiPersonalitiesTable).values(parsed.data).returning();
  res.status(201).json({ ...personality, createdAt: personality.createdAt.toISOString() });
});

router.patch("/ai/personalities/:id", async (req, res): Promise<void> => {
  const params = UpdatePersonalityParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdatePersonalityBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [personality] = await db.update(aiPersonalitiesTable).set(parsed.data).where(eq(aiPersonalitiesTable.id, params.data.id)).returning();
  if (!personality) { res.status(404).json({ error: "Personality not found" }); return; }
  res.json({ ...personality, createdAt: personality.createdAt.toISOString() });
});

router.delete("/ai/personalities/:id", async (req, res): Promise<void> => {
  const params = DeletePersonalityParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(aiPersonalitiesTable).where(eq(aiPersonalitiesTable.id, params.data.id));
  res.sendStatus(204);
});

// ── Generate Content ───────────────────────────────────
router.post("/ai/generate", async (req, res): Promise<void> => {
  const parsed = GenerateContentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { prompt, personalityId, contentType, language, context } = parsed.data;

  let personalityName: string | null = null;
  let systemPromptExtra = "";

  if (personalityId) {
    const [p] = await db.select().from(aiPersonalitiesTable).where(eq(aiPersonalitiesTable.id, personalityId));
    if (p) {
      personalityName = p.name;
      systemPromptExtra = p.systemPrompt ?? `You are a ${p.type} AI assistant. Tone: ${p.tone}. Energy: ${p.energyLevel}/100.`;
    }
  }

  const openaiKey = process.env["OPENAI_API_KEY"];
  const geminiKey = process.env["GEMINI_API_KEY"];

  let content = "";
  let model = "template";
  let tokensUsed = 0;

  const templates: Record<string, string[]> = {
    motivation: [
      "Every great journey begins with a single step. Keep pushing forward — your breakthrough is closer than you think.",
      "The difference between where you are and where you want to be is what you do today. Make it count.",
      "Success is not a destination — it's a daily commitment to showing up and giving your best.",
    ],
    crypto: [
      "Markets move in cycles. The disciplined investor studies the fundamentals, not the noise.",
      "DCA through the volatility. Time in the market beats timing the market — always.",
      "Strong hands are built in bear markets. The accumulation zone is where generational wealth begins.",
    ],
    marketing: [
      "Your audience doesn't need more information — they need the right information at the right moment.",
      "The best marketing doesn't feel like marketing. Build trust, deliver value, convert naturally.",
    ],
    announcement: ["Important update for our community — please read carefully."],
    support: ["We're here to help. Please share more details and we'll resolve this quickly."],
    welcome: ["Welcome to the community! We're glad you're here. Feel free to introduce yourself."],
  };

  const getTemplate = () => {
    const key = contentType ?? "motivation";
    const options = templates[key] ?? templates["motivation"];
    return options[Math.floor(Math.random() * options.length)] ?? "";
  };

  try {
    // Try OpenAI first
    if (openaiKey) {
      try {
        const { default: OpenAI } = await import("openai");
        const openai = new OpenAI({ apiKey: openaiKey });
        const systemMsg = [
          systemPromptExtra,
          context ? `Context: ${context}` : "",
          language ? `Respond in: ${language}` : "",
          contentType ? `Content type: ${contentType}` : "",
        ].filter(Boolean).join("\n");

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: systemMsg || "You are an intelligent AI assistant for Telegram automation." },
            { role: "user", content: prompt },
          ],
          max_tokens: 500,
        });
        content = completion.choices[0]?.message?.content ?? "";
        model = "gpt-4o";
        tokensUsed = completion.usage?.total_tokens ?? 0;
      } catch (openaiErr: any) {
        // If quota/rate-limit, fall through to Gemini or template
        const isQuotaError = openaiErr?.status === 429 || openaiErr?.code === "insufficient_quota";
        if (!isQuotaError) throw openaiErr;
        logger.warn({ code: openaiErr?.code }, "OpenAI quota exceeded — falling back to Gemini/template");
      }
    }

    // Final fallback: template (Gemini available via Python backend)
    if (!content) {
      content = getTemplate();
      model = "template";
      tokensUsed = 0;
    }

    await db.insert(aiLogsTable).values({
      action: "generate_content",
      model,
      prompt,
      response: content,
      tokensUsed,
      success: true,
    });

    res.json({ content, model, tokensUsed, personalityApplied: personalityName });
  } catch (err) {
    logger.error({ err }, "AI generation failed");
    // Last resort: return template even on unexpected error
    const fallbackContent = getTemplate();
    await db.insert(aiLogsTable).values({
      action: "generate_content",
      model: "template",
      prompt,
      response: fallbackContent,
      success: false,
      errorMessage: String(err),
    });
    res.json({ content: fallbackContent, model: "template", tokensUsed: 0, personalityApplied: personalityName });
  }
});

// ── AI Logs ────────────────────────────────────────────
router.get("/ai/logs", async (_req, res): Promise<void> => {
  const logs = await db.select().from(aiLogsTable).orderBy(desc(aiLogsTable.createdAt)).limit(100);
  res.json(logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })));
});

export default router;
