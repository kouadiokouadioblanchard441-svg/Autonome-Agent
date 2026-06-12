import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const telegramAccountsTable = pgTable("telegram_accounts", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull().unique(),
  username: text("username"),
  displayName: text("display_name"),
  status: text("status").notNull().default("inactive"),
  personalityId: integer("personality_id"),
  isConnected: boolean("is_connected").notNull().default(false),
  sessionData: text("session_data"),
  lastSeen: timestamp("last_seen", { withTimezone: true }),
  messagesCount: integer("messages_count").notNull().default(0),
  groupsCount: integer("groups_count").notNull().default(0),
  healthScore: integer("health_score").notNull().default(100),
  timezone: text("timezone").default("UTC"),
  activeHoursStart: integer("active_hours_start").default(8),
  activeHoursEnd: integer("active_hours_end").default(23),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTelegramAccountSchema = createInsertSchema(telegramAccountsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTelegramAccount = z.infer<typeof insertTelegramAccountSchema>;
export type TelegramAccount = typeof telegramAccountsTable.$inferSelect;
