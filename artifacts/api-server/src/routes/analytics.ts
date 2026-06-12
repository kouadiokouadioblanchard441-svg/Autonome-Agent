import { Router } from "express";
import { db, telegramAccountsTable, telegramGroupsTable, telegramChannelsTable, messagesTable, campaignsTable, securityLogsTable } from "@workspace/db";
import { desc, gte } from "drizzle-orm";

const router = Router();

router.get("/analytics/dashboard", async (_req, res): Promise<void> => {
  const [accounts, groups, channels, messages, campaigns, secLogs] = await Promise.all([
    db.select().from(telegramAccountsTable),
    db.select().from(telegramGroupsTable),
    db.select().from(telegramChannelsTable),
    db.select().from(messagesTable),
    db.select().from(campaignsTable),
    db.select().from(securityLogsTable),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMsgs = messages.filter((m) => new Date(m.createdAt) >= today);
  const todayThreats = secLogs.filter((l) => new Date(l.createdAt) >= today);

  res.json({
    totalAccounts: accounts.length,
    activeAccounts: accounts.filter((a) => a.status === "active").length,
    totalGroups: groups.length,
    totalChannels: channels.length,
    messagesToday: todayMsgs.length,
    aiMessagesToday: todayMsgs.filter((m) => m.isAIGenerated).length,
    campaignsActive: campaigns.filter((c) => c.status === "active").length,
    threatsToday: todayThreats.length,
    totalMessagesSent: messages.filter((m) => m.direction === "outbound").length,
    uptime: "99.8%",
  });
});

router.get("/analytics/activity", async (_req, res): Promise<void> => {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [messages, secLogs] = await Promise.all([
    db.select().from(messagesTable).orderBy(desc(messagesTable.createdAt)),
    db.select().from(securityLogsTable).orderBy(desc(securityLogsTable.createdAt)),
  ]);

  const result: Array<{ date: string; messages: number; aiMessages: number; threats: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dEnd = new Date(d);
    dEnd.setHours(23, 59, 59, 999);

    const dayMsgs = messages.filter((m) => {
      const t = new Date(m.createdAt);
      return t >= d && t <= dEnd;
    });
    const dayThreats = secLogs.filter((l) => {
      const t = new Date(l.createdAt);
      return t >= d && t <= dEnd;
    });

    result.push({
      date: d.toISOString().split("T")[0] ?? d.toLocaleDateString(),
      messages: dayMsgs.length,
      aiMessages: dayMsgs.filter((m) => m.isAIGenerated).length,
      threats: dayThreats.length,
    });
  }
  res.json(result);
});

router.get("/analytics/engagement", async (_req, res): Promise<void> => {
  const [groups, channels] = await Promise.all([
    db.select().from(telegramGroupsTable),
    db.select().from(telegramChannelsTable),
  ]);

  const result = [
    ...groups.map((g) => ({
      name: g.title,
      type: "group" as const,
      messages: g.messagesCount,
      engagement: Math.min(100, Math.round((g.messagesCount / Math.max(g.membersCount ?? 1, 1)) * 100)),
      membersCount: g.membersCount,
    })),
    ...channels.map((c) => ({
      name: c.title,
      type: "channel" as const,
      messages: c.postsCount,
      engagement: Math.min(100, Math.round((c.postsCount / Math.max(c.subscribersCount ?? 1, 1)) * 100)),
      membersCount: c.subscribersCount,
    })),
  ];

  res.json(result);
});

export default router;
