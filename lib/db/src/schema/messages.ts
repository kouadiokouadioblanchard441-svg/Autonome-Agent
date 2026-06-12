import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const messagesTable = pgTable("messages", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id"),
  groupId: integer("group_id"),
  channelId: integer("channel_id"),
  content: text("content").notNull(),
  direction: text("direction").notNull().default("outbound"),
  status: text("status").notNull().default("pending"),
  isAIGenerated: boolean("is_ai_generated").notNull().default(false),
  senderUsername: text("sender_username"),
  telegramMessageId: text("telegram_message_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertMessageSchema = createInsertSchema(messagesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
