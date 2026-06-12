import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiPersonalitiesTable = pgTable("ai_personalities", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("professional"),
  description: text("description"),
  tone: text("tone").notNull().default("neutral"),
  emojiFrequency: text("emoji_frequency").notNull().default("low"),
  energyLevel: integer("energy_level").notNull().default(50),
  isDefault: boolean("is_default").notNull().default(false),
  systemPrompt: text("system_prompt"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const aiLogsTable = pgTable("ai_logs", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id"),
  action: text("action").notNull(),
  model: text("model").notNull().default("gpt-4o"),
  prompt: text("prompt"),
  response: text("response"),
  tokensUsed: integer("tokens_used"),
  success: boolean("success").notNull().default(true),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAIPersonalitySchema = createInsertSchema(aiPersonalitiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAIPersonality = z.infer<typeof insertAIPersonalitySchema>;
export type AIPersonality = typeof aiPersonalitiesTable.$inferSelect;

export const insertAILogSchema = createInsertSchema(aiLogsTable).omit({ id: true, createdAt: true });
export type InsertAILog = z.infer<typeof insertAILogSchema>;
export type AILog = typeof aiLogsTable.$inferSelect;
