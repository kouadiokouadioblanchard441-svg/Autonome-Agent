import { Router } from "express";
import bcrypt from "bcryptjs";

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

  const emailMatch = email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
  const passMatch = ADMIN_PASSWORD_HASH ? await bcrypt.compare(password, ADMIN_PASSWORD_HASH) : false;

  if (!emailMatch || !passMatch) {
    res.status(401).json({ error: "Identifiants invalides" });
    return;
  }

  (req.session as any).admin = { email: ADMIN_EMAIL, name: ADMIN_NAME, loggedInAt: new Date().toISOString() };
  res.json({ ok: true, admin: { email: ADMIN_EMAIL, name: ADMIN_NAME } });
});

router.post("/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("nexus.sid");
    res.json({ ok: true });
  });
});

router.get("/auth/me", (req, res) => {
  const admin = (req.session as any)?.admin;
  if (!admin) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }
  res.json({ admin });
});

export default router;
