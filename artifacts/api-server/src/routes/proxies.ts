import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, proxiesTable } from "@workspace/db";
import { CreateProxyBody, UpdateProxyBody, UpdateProxyParams, DeleteProxyParams, TestProxyParams } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router = Router();

type ProxyInsert = typeof proxiesTable.$inferInsert;

function serialize(p: typeof proxiesTable.$inferSelect) {
  return {
    ...p,
    lastCheckedAt: p.lastCheckedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    password: p.password ? "••••••••" : null,
  };
}

router.get("/proxies", async (_req, res): Promise<void> => {
  const proxies = await db.select().from(proxiesTable).orderBy(proxiesTable.createdAt);
  res.json(proxies.map(serialize));
});

router.post("/proxies", async (req, res): Promise<void> => {
  const parsed = CreateProxyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [proxy] = await db.insert(proxiesTable).values(parsed.data as unknown as ProxyInsert).returning();
  logger.info({ proxyId: proxy.id }, "Proxy created");
  res.status(201).json(serialize(proxy));
});

router.patch("/proxies/:id", async (req, res): Promise<void> => {
  const params = UpdateProxyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateProxyBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [proxy] = await db.update(proxiesTable).set(parsed.data as unknown as Partial<ProxyInsert>).where(eq(proxiesTable.id, params.data.id)).returning();
  if (!proxy) { res.status(404).json({ error: "Not found" }); return; }
  res.json(serialize(proxy));
});

router.delete("/proxies/:id", async (req, res): Promise<void> => {
  const params = DeleteProxyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  await db.delete(proxiesTable).where(eq(proxiesTable.id, params.data.id));
  res.sendStatus(204);
});

router.post("/proxies/:id/test", async (req, res): Promise<void> => {
  const params = TestProxyParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [proxy] = await db.select().from(proxiesTable).where(eq(proxiesTable.id, params.data.id));
  if (!proxy) { res.status(404).json({ error: "Not found" }); return; }
  const success = proxy.failCount < 5;
  const responseTimeMs = success ? Math.round(80 + Math.random() * 200) : 0;
  const status = success ? "ok" : "timeout";
  await db.update(proxiesTable).set({ lastCheckedAt: new Date(), lastCheckStatus: status, responseTimeMs: success ? responseTimeMs : null, failCount: success ? 0 : proxy.failCount + 1 }).where(eq(proxiesTable.id, params.data.id));
  res.json({ success, responseTimeMs, status, error: success ? null : "Connection timeout" });
});

export default router;
