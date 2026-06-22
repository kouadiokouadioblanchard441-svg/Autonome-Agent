import { Router } from "express";
import { db, telegramAccountsTable, telegramGroupsTable, telegramChannelsTable, messagesTable, aiLogsTable } from "@workspace/db";
import { desc, gte } from "drizzle-orm";

const router = Router();
const PYTHON_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8090";

// Monitoring overview: engine status + recent activity
router.get("/monitoring/status", async (_req, res): Promise<void> => {
  try {
    // Fetch Python engine status (with short timeout)
    let engineStatus: any = null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const pyRes = await fetch(`${PYTHON_URL}/monitoring/status`, { signal: ctrl.signal });
      clearTimeout(timer);
      engineStatus = await pyRes.json();
    } catch {
      engineStatus = { error: "Python engine unreachable" };
    }

    // DB stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

    const [accounts, groups, channels, todayMsgs, recentAiLogs] = await Promise.all([
      db.select().from(telegramAccountsTable),
      db.select().from(telegramGroupsTable),
      db.select().from(telegramChannelsTable),
      db.select().from(messagesTable).where(gte(messagesTable.createdAt, today)),
      db.select().from(aiLogsTable).orderBy(desc(aiLogsTable.createdAt)).limit(20),
    ]);

    const activeAccounts = accounts.filter((a) => a.status === "active");
    const connectedAccounts = accounts.filter((a) => a.isConnected);

    // Activity per day for last 7 days
    const allMsgs = await db.select().from(messagesTable).where(gte(messagesTable.createdAt, sevenDaysAgo));
    const dailyActivity: Record<string, { messages: number; aiMessages: number }> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      dailyActivity[d.toISOString().slice(0, 10)] = { messages: 0, aiMessages: 0 };
    }
    for (const m of allMsgs) {
      const day = new Date(m.createdAt).toISOString().slice(0, 10);
      if (dailyActivity[day]) {
        dailyActivity[day].messages++;
        if (m.isAIGenerated) dailyActivity[day].aiMessages++;
      }
    }

    res.json({
      services: {
        python_engine: engineStatus?.db_connected != null,
        bot_running: engineStatus?.bot_running ?? false,
        db_connected: true,
        active_clients: engineStatus?.engine?.active_clients ?? 0,
      },
      engine: engineStatus?.engine ?? {},
      reports: engineStatus?.reports ?? {},
      db: {
        total_accounts: accounts.length,
        active_accounts: activeAccounts.length,
        connected_accounts: connectedAccounts.length,
        total_groups: groups.length,
        active_groups: groups.filter((g) => g.isMonitored).length,
        total_channels: channels.length,
        auto_post_channels: channels.filter((c) => c.isAutoPost).length,
        messages_today: todayMsgs.length,
        ai_messages_today: todayMsgs.filter((m) => m.isAIGenerated).length,
      },
      recent_ai_logs: recentAiLogs.map((l) => ({
        id: l.id,
        account_id: l.accountId,
        action: l.action,
        model: l.model,
        success: l.success,
        created_at: l.createdAt,
        prompt_preview: (l.prompt ?? "").slice(0, 80),
        response_preview: (l.response ?? "").slice(0, 120),
      })),
      daily_activity: Object.entries(dailyActivity).map(([date, v]) => ({ date, ...v })),
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Trigger manual report (daily or weekly)
router.post("/monitoring/reports/trigger", async (req, res): Promise<void> => {
  const { type = "daily" } = req.body as { type?: string };
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    const pyRes = await fetch(`${PYTHON_URL}/monitoring/reports/trigger`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
      signal: ctrl.signal,
    });
    const result = await pyRes.json().catch(() => ({ ok: true }));
    res.json(result);
  } catch {
    res.json({ ok: false, message: "Python engine non disponible" });
  }
});

export default router;
