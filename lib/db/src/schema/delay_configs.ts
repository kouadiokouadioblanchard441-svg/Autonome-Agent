import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const delayConfigsTable = pgTable("delay_configs", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id"),
  groupId: integer("group_id"),
  name: text("name").notNull().default("Default"),
  isGlobal: boolean("is_global").notNull().default(false),

  minReplyDelay: real("min_reply_delay").notNull().default(10),
  maxReplyDelay: real("max_reply_delay").notNull().default(180),
  typingEnabled: boolean("typing_enabled").notNull().default(true),
  typingSpeed: text("typing_speed").notNull().default("human"),
  onlineSimulation: boolean("online_simulation").notNull().default(true),
  nightSlowMode: boolean("night_slow_mode").notNull().default(true),
  randomBreaks: boolean("random_breaks").notNull().default(true),
  readingSimulation: boolean("reading_simulation").notNull().default(true),
  readingSpeedWpm: integer("reading_speed_wpm").notNull().default(220),
  priorityUsers: text("priority_users").notNull().default("[]"),
  priorityMultiplier: real("priority_multiplier").notNull().default(0.3),
  nightMultiplier: real("night_multiplier").notNull().default(3.0),
  nightStartHour: integer("night_start_hour").notNull().default(23),
  nightEndHour: integer("night_end_hour").notNull().default(7),
  breakProbability: real("break_probability").notNull().default(0.05),
  breakMinDuration: real("break_min_duration").notNull().default(300),
  breakMaxDuration: real("break_max_duration").notNull().default(1800),
  activeHoursStart: integer("active_hours_start").notNull().default(8),
  activeHoursEnd: integer("active_hours_end").notNull().default(23),
  contextAdaptation: boolean("context_adaptation").notNull().default(true),

  activePeriods: text("active_periods").notNull().default("[[8,12],[13,17],[18,22]]"),
  cooldownMinutes: real("cooldown_minutes").notNull().default(30),
  maxContinuousActiveMinutes: real("max_continuous_active_minutes").notNull().default(120),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDelayConfigSchema = createInsertSchema(delayConfigsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDelayConfig = z.infer<typeof insertDelayConfigSchema>;
export type DelayConfig = typeof delayConfigsTable.$inferSelect;
