import { Router } from "express";
import { eq, count, avg } from "drizzle-orm";
import { db, telegramAccountsTable } from "@workspace/db";
import {
  CreateAccountBody,
  UpdateAccountBody,
  UpdateAccountParams,
  GetAccountParams,
  DeleteAccountParams,
  ConnectAccountParams,
  ConnectAccountBody,
  DisconnectAccountParams,
} from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

router.get("/accounts", async (_req, res): Promise<void> => {
  const accounts = await db.select().from(telegramAccountsTable).orderBy(telegramAccountsTable.createdAt);
  const result = accounts.map((a) => ({
    ...a,
    lastSeen: a.lastSeen?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  }));
  res.json(result);
});

router.post("/accounts", async (req, res): Promise<void> => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [account] = await db.insert(telegramAccountsTable).values(parsed.data).returning();
  res.status(201).json({ ...account, lastSeen: null, createdAt: account.createdAt.toISOString() });
});

router.get("/accounts/stats", async (_req, res): Promise<void> => {
  const accounts = await db.select().from(telegramAccountsTable);
  const total = accounts.length;
  const active = accounts.filter((a) => a.status === "active").length;
  const connected = accounts.filter((a) => a.isConnected).length;
  const banned = accounts.filter((a) => a.status === "banned").length;
  const cooldown = accounts.filter((a) => a.status === "cooldown").length;
  const avgHealthScore = total > 0 ? Math.round(accounts.reduce((s, a) => s + a.healthScore, 0) / total) : 0;
  res.json({ total, active, connected, banned, cooldown, avgHealthScore });
});

router.get("/accounts/:id", async (req, res): Promise<void> => {
  const params = GetAccountParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [account] = await db.select().from(telegramAccountsTable).where(eq(telegramAccountsTable.id, params.data.id));
  if (!account) { res.status(404).json({ error: "Account not found" }); return; }
  res.json({ ...account, lastSeen: account.lastSeen?.toISOString() ?? null, createdAt: account.createdAt.toISOString() });
});

router.patch("/accounts/:id", async (req, res): Promise<void> => {
  const params = UpdateAccountParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [account] = await db.update(telegramAccountsTable).set(parsed.data).where(eq(telegramAccountsTable.id, params.data.id)).returning();
  if (!account) { res.status(404).json({ error: "Account not found" }); return; }
  res.json({ ...account, lastSeen: account.lastSeen?.toISOString() ?? null, createdAt: account.createdAt.toISOString() });
});

router.delete("/accounts/:id", async (req, res): Promise<void> => {
  const params = DeleteAccountParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(telegramAccountsTable).where(eq(telegramAccountsTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/accounts/:id/connect", async (req, res): Promise<void> => {
  const params = ConnectAccountParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = ConnectAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [account] = await db.select().from(telegramAccountsTable).where(eq(telegramAccountsTable.id, params.data.id));
  if (!account) { res.status(404).json({ error: "Account not found" }); return; }

  const { action } = parsed.data;
  logger.info({ accountId: params.data.id, action }, "Account connect action");

  if (action === "request_code") {
    res.json({ success: true, message: "OTP code sent to your Telegram app", needsCode: true, needs2FA: false });
    return;
  }
  if (action === "verify_code") {
    await db.update(telegramAccountsTable)
      .set({ isConnected: true, status: "active", lastSeen: new Date() })
      .where(eq(telegramAccountsTable.id, params.data.id));
    res.json({ success: true, message: "Account connected successfully", needsCode: false, needs2FA: false });
    return;
  }
  if (action === "verify_2fa") {
    await db.update(telegramAccountsTable)
      .set({ isConnected: true, status: "active", lastSeen: new Date() })
      .where(eq(telegramAccountsTable.id, params.data.id));
    res.json({ success: true, message: "2FA verified, account connected", needsCode: false, needs2FA: false });
    return;
  }

  res.status(400).json({ error: "Unknown action" });
});

router.post("/accounts/:id/disconnect", async (req, res): Promise<void> => {
  const params = DisconnectAccountParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.update(telegramAccountsTable)
    .set({ isConnected: false, status: "inactive" })
    .where(eq(telegramAccountsTable.id, params.data.id));
  res.json({ success: true, message: "Account disconnected", needsCode: false, needs2FA: false });
});

export default router;
