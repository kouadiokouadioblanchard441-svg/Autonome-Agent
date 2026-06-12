import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const telegramChannelsTable = pgTable("telegram_channels", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  title: text("title").notNull(),
  username: text("username"),
  subscribersCount: integer("subscribers_count"),
  isAutoPost: boolean("is_auto_post").notNull().default(false),
  accountId: integer("account_id"),
  postsCount: integer("posts_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTelegramChannelSchema = createInsertSchema(telegramChannelsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTelegramChannel = z.infer<typeof insertTelegramChannelSchema>;
export type TelegramChannel = typeof telegramChannelsTable.$inferSelect;
