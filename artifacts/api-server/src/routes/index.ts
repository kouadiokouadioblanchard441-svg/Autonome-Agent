import { Router, type IRouter } from "express";
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

const router: IRouter = Router();

router.use(healthRouter);
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

export default router;
