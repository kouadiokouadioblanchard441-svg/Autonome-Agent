import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const securityLogsTable = pgTable("security_logs", {
  id: serial("id").primaryKey(),
  eventType: text("event_type").notNull(),
  severity: text("severity").notNull().default("low"),
  targetUsername: text("target_username"),
  groupId: integer("group_id"),
  accountId: integer("account_id"),
  description: text("description").notNull().default(""),
  actionTaken: text("action_taken"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sanctionsTable = pgTable("sanctions", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(),
  targetUsername: text("target_username").notNull(),
  targetUserId: text("target_user_id"),
  groupId: integer("group_id"),
  accountId: integer("account_id"),
  reason: text("reason").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSecurityLogSchema = createInsertSchema(securityLogsTable).omit({ id: true, createdAt: true });
export type InsertSecurityLog = z.infer<typeof insertSecurityLogSchema>;
export type SecurityLog = typeof securityLogsTable.$inferSelect;

export const insertSanctionSchema = createInsertSchema(sanctionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSanction = z.infer<typeof insertSanctionSchema>;
export type Sanction = typeof sanctionsTable.$inferSelect;
