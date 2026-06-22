import { Router } from "express";
import { eq } from "drizzle-orm";
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
const PYTHON_ENGINE = process.env.PYTHON_ENGINE_URL ?? "http://localhost:8090";

async function callPython(path: string, body: unknown): Promise<{ ok: boolean; data: any }> {
  try {
    const res = await fetch(`${PYTHON_ENGINE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch (err) {
    logger.error({ err, path }, "Python engine call failed");
    return { ok: false, data: { message: String(err) } };
  }
}

router.get("/accounts", async (_req, res): Promise<void> => {
  const accounts = await db.select().from(telegramAccountsTable).orderBy(telegramAccountsTable.createdAt);
  res.json(accounts.map((a) => ({
    ...a,
    lastSeen: a.lastSeen?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  })));
});

router.post("/accounts", async (req, res): Promise<void> => {
  const parsed = CreateAccountBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
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

  const { action, code, password } = parsed.data as any;
  logger.info({ accountId: params.data.id, action }, "Account connect action");

  // ── Step 1: request_code → ask Python to send OTP via Telethon ──────────────
  if (action === "request_code") {
    const { ok, data } = await callPython("/telegram/connect", {
      account_id: account.id,
      phone_number: account.phoneNumber,
      session_data: account.sessionData ?? null,
    });
    if (!ok) {
      res.status(500).json({ success: false, message: data?.detail ?? data?.message ?? "Erreur moteur Python" });
      return;
    }
    res.json({ success: data.success, message: data.message, needsCode: data.needs_code ?? false, needs2FA: false });
    return;
  }

  // ── Step 2: verify_code → ask Python to sign_in with OTP ────────────────────
  if (action === "verify_code") {
    const { ok, data } = await callPython("/telegram/verify", {
      account_id: account.id,
      phone_number: account.phoneNumber,
      code,
    });
    if (!ok) {
      res.status(400).json({ success: false, message: data?.detail ?? data?.message ?? "Code invalide" });
      return;
    }
    if (data.needs_2fa) {
      res.json({ success: false, message: "Mot de passe 2FA requis", needsCode: false, needs2FA: true });
      return;
    }
    // Python already updated the DB — refresh from DB so caller gets latest state
    const [updated] = await db.select().from(telegramAccountsTable).where(eq(telegramAccountsTable.id, account.id));
    res.json({ success: true, message: data.message, needsCode: false, needs2FA: false, username: updated?.username });
    return;
  }

  // ── Step 3: verify_2fa → ask Python to sign_in with password ────────────────
  if (action === "verify_2fa") {
    const { ok, data } = await callPython("/telegram/verify-2fa", {
      account_id: account.id,
      password,
    });
    if (!ok) {
      res.status(400).json({ success: false, message: data?.detail ?? data?.message ?? "2FA invalide" });
      return;
    }
    const [updated] = await db.select().from(telegramAccountsTable).where(eq(telegramAccountsTable.id, account.id));
    res.json({ success: true, message: data.message, needsCode: false, needs2FA: false, username: updated?.username });
    return;
  }

  res.status(400).json({ error: "Action inconnue" });
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
