import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import session from "express-session";
import router from "./routes";
import { logger } from "./lib/logger";
import { db } from "@workspace/db";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: "nexus.sid",
    secret: process.env.SESSION_SECRET ?? "nexus-ai-default-secret-change-in-prod",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: "lax",
    },
  }),
);

// Health check public (no DB needed) — Passenger/Plesk uptime check
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    db: db ? "connected" : "unavailable",
    timestamp: new Date().toISOString(),
  });
});

// Middleware: si DB non configurée, bloquer les routes qui en dépendent
app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (!db) {
    res.status(503).json({
      error: "Base de données non configurée — vérifiez SUPABASE_DATABASE_URL dans les variables d'environnement Plesk.",
    });
    return;
  }
  next();
});

app.use("/api", router);

export default app;
