import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import healthRouter from "./health";
import accountsRouter from "./accounts";
import groupsRouter from "./groups";
import channelsRouter from "./channels";
import messagesRouter from "./messages";
import campaignsRouter from "./campaigns";
import schedulesRouter from "./schedules";
import aiRouter from "./ai";
import securityRouter from "./security";
import analyticsRouter from "./analytics";
import notificationsRouter from "./notifications";
import delayRouter from "./delay";
import settingsRouter from "./settings";
import warmupRouter from "./warmup";
import proxiesRouter from "./proxies";
import floodRouter from "./flood";
import memoriesRouter from "./memories";
import leadsRouter from "./leads";
import abTestsRouter from "./ab-tests";
import autoJoinRouter from "./auto-join";
import escalationsRouter from "./escalations";
import authRouter from "./auth";

const router: IRouter = Router();

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const admin = (req.session as any)?.admin;
  if (!admin) {
    res.status(401).json({ error: "Non authentifié — accès refusé" });
    return;
  }
  next();
}

router.use(healthRouter);
router.use(authRouter);

router.use(requireAuth);

router.use(accountsRouter);
router.use(groupsRouter);
router.use(channelsRouter);
router.use(messagesRouter);
router.use(campaignsRouter);
router.use(schedulesRouter);
router.use(aiRouter);
router.use(securityRouter);
router.use(analyticsRouter);
router.use(notificationsRouter);
router.use(delayRouter);
router.use(settingsRouter);
router.use(warmupRouter);
router.use(proxiesRouter);
router.use(floodRouter);
router.use(memoriesRouter);
router.use(leadsRouter);
router.use(abTestsRouter);
router.use(autoJoinRouter);
router.use(escalationsRouter);

export default router;
