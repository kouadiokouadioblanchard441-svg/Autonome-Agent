import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const telegramGroupsTable = pgTable("telegram_groups", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  title: text("title").notNull(),
  username: text("username"),
  membersCount: integer("members_count"),
  isMonitored: boolean("is_monitored").notNull().default(false),
  isAutoReply: boolean("is_auto_reply").notNull().default(false),
  isAutoModerate: boolean("is_auto_moderate").notNull().default(false),
  accountId: integer("account_id"),
  messagesCount: integer("messages_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTelegramGroupSchema = createInsertSchema(telegramGroupsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTelegramGroup = z.infer<typeof insertTelegramGroupSchema>;
export type TelegramGroup = typeof telegramGroupsTable.$inferSelect;
