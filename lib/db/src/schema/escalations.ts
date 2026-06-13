import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";

export const escalationsTable = pgTable("escalations", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  contactPhone: text("contact_phone"),
  contactUsername: text("contact_username"),
  contactName: text("contact_name"),
  conversationSnippet: text("conversation_snippet"),
  sentimentScore: real("sentiment_score").notNull().default(0), // -1 (very negative) to 1 (positive)
  reason: text("reason").notNull().default("human_needed"), // angry | suspicious | human_needed | spam_detected | other
  status: text("status").notNull().default("pending"), // pending | reviewed | resolved | ignored
  aiPaused: integer("ai_paused").notNull().default(1), // 1 = AI paused for this contact
  detectedLanguage: text("detected_language"),
  assignedTo: text("assigned_to"),
  reviewNote: text("review_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});
