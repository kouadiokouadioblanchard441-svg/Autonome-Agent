import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { clientPortals } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH ?? "";
const ADMIN_NAME = process.env.ADMIN_NAME ?? "Admin";

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: "Email et mot de passe requis" });
    return;
  }

  // Check admin first
  const emailNorm = email.toLowerCase().trim();
  const isAdminEmail = emailNorm === ADMIN_EMAIL.toLowerCase().trim();
  if (isAdminEmail && ADMIN_PASSWORD_HASH) {
    const passMatch = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if (passMatch) {
      (req.session as any).role = "admin";
      (req.session as any).admin = { email: ADMIN_EMAIL, name: ADMIN_NAME, loggedInAt: new Date().toISOString() };
      res.json({ ok: true, role: "admin", user: { email: ADMIN_EMAIL, name: ADMIN_NAME } });
      return;
    }
  }

  // Check client portals
  try {
    const [portal] = await db.select().from(clientPortals).where(eq(clientPortals.clientEmail, emailNorm));
    if (!portal || !portal.isActive) {
      res.status(401).json({ error: "Identifiants invalides" });
      return;
    }
    const passMatch = await bcrypt.compare(password, portal.passwordHash);
    if (!passMatch) {
      res.status(401).json({ error: "Identifiants invalides" });
      return;
    }
    await db.update(clientPortals).set({ lastLoginAt: new Date() }).where(eq(clientPortals.id, portal.id));
    (req.session as any).role = "client";
    (req.session as any).client = { id: portal.id, email: portal.clientEmail, name: portal.clientName, accountId: portal.accountId };
    res.json({ ok: true, role: "client", user: { email: portal.clientEmail, name: portal.clientName, accountId: portal.accountId } });
  } catch {
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("nexus.sid");
    res.json({ ok: true });
  });
});

router.get("/auth/me", (req, res) => {
  const role = (req.session as any)?.role;
  if (role === "admin") {
    res.json({ role: "admin", user: (req.session as any).admin });
    return;
  }
  if (role === "client") {
    res.json({ role: "client", user: (req.session as any).client });
    return;
  }
  res.status(401).json({ error: "Non authentifié" });
});

export default router;
