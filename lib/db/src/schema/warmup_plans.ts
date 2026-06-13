import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";

export const warmupPlansTable = pgTable("warmup_plans", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  status: text("status").notNull().default("draft"), // draft | active | paused | completed
  startDate: timestamp("start_date"),
  currentDay: integer("current_day").notNull().default(0),
  totalDays: integer("total_days").notNull().default(14),
  dailyLimitStart: integer("daily_limit_start").notNull().default(1),
  dailyLimitEnd: integer("daily_limit_end").notNull().default(50),
  todayCount: integer("today_count").notNull().default(0),
  todayLimit: integer("today_limit").notNull().default(1),
  growthType: text("growth_type").notNull().default("linear"), // linear | exponential
  notes: text("notes"),
  lastActivityAt: timestamp("last_activity_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
