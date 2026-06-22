import { Router } from "express";

const router = Router();
const PYTHON_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:9000";

async function pyFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${PYTHON_URL}${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  return res.json();
}

// List all groups + channels with their schedule and community profiles
router.get("/communities", async (_req, res): Promise<void> => {
  try {
    const data = await pyFetch("/monitoring/communities");
    res.json(data);
  } catch (e: any) {
    res.status(503).json({ groups: [], channels: [], error: e.message });
  }
});

// Update schedule config for a specific community
router.put("/communities/:chatType/:tgId/schedule", async (req, res): Promise<void> => {
  const { chatType, tgId } = req.params;
  try {
    const result = await pyFetch(`/monitoring/communities/${chatType}/${tgId}/schedule`, {
      method: "PUT",
      body: JSON.stringify(req.body),
    });
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;
