import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { clientPortals, telegramAccountsTable, messagesTable, campaignsTable } from "@workspace/db/schema";
import { eq, desc, count, and } from "drizzle-orm";

const router = Router();

// ── Admin: list all portals ──────────────────────────────────────────────────
router.get("/client-portals", async (req, res) => {
  try {
    const portals = await db.select().from(clientPortals).orderBy(desc(clientPortals.createdAt));
    const enriched = await Promise.all(
      portals.map(async (p) => {
        const [acc] = await db
          .select({ id: telegramAccountsTable.id, username: telegramAccountsTable.username, displayName: telegramAccountsTable.displayName, healthScore: telegramAccountsTable.healthScore, status: telegramAccountsTable.status })
          .from(telegramAccountsTable)
          .where(eq(telegramAccountsTable.id, p.accountId));
        return { ...p, passwordHash: undefined, account: acc ?? null };
      })
    );
    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Admin: create portal for a client ───────────────────────────────────────
router.post("/client-portals", async (req, res) => {
  const { accountId, clientName, clientEmail, password, notes } = req.body ?? {};
  if (!accountId || !clientName || !clientEmail || !password) {
    res.status(400).json({ error: "accountId, clientName, clientEmail, password requis" });
    return;
  }
  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const [portal] = await db.insert(clientPortals).values({
      accountId: Number(accountId),
      clientName,
      clientEmail: clientEmail.toLowerCase().trim(),
      passwordHash,
      notes: notes ?? null,
      isActive: true,
    }).returning();
    res.status(201).json({ ...portal, passwordHash: undefined });
  } catch (e: any) {
    if (e?.code === "23505") {
      res.status(409).json({ error: "Cet email est déjà utilisé pour un portail client" });
    } else {
      res.status(500).json({ error: String(e) });
    }
  }
});

// ── Admin: update portal (reset password / toggle active / notes) ────────────
router.patch("/client-portals/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { password, isActive, notes, clientName } = req.body ?? {};
  const patch: Record<string, any> = {};
  if (password) patch.passwordHash = await bcrypt.hash(password, 12);
  if (isActive !== undefined) patch.isActive = Boolean(isActive);
  if (notes !== undefined) patch.notes = notes;
  if (clientName) patch.clientName = clientName;
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Rien à mettre à jour" });
    return;
  }
  try {
    const [updated] = await db.update(clientPortals).set(patch).where(eq(clientPortals.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Portail introuvable" }); return; }
    res.json({ ...updated, passwordHash: undefined });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Admin: delete portal ─────────────────────────────────────────────────────
router.delete("/client-portals/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await db.delete(clientPortals).where(eq(clientPortals.id, id));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ── Client: get their own dashboard overview ─────────────────────────────────
router.get("/client-portal/overview", async (req, res) => {
  const role = (req.session as any)?.role;
  const clientSession = (req.session as any)?.client;
  if (role !== "client" || !clientSession) {
    res.status(403).json({ error: "Accès client requis" });
    return;
  }
  const accountId = Number(clientSession.accountId);
  try {
    const [acc] = await db.select().from(telegramAccountsTable).where(eq(telegramAccountsTable.id, accountId));
    const [msgCount] = await db.select({ value: count() }).from(messagesTable).where(eq(messagesTable.accountId, accountId));
    const activeCampaigns = await db
      .select({ id: campaignsTable.id, name: campaignsTable.name, status: campaignsTable.status })
      .from(campaignsTable)
      .where(and(eq(campaignsTable.status, "active")));
    const recentMessages = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.accountId, accountId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(20);
    res.json({
      account: acc ?? null,
      stats: { totalMessages: msgCount?.value ?? 0, activeCampaigns: activeCampaigns.length },
      activeCampaigns,
      recentMessages,
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
