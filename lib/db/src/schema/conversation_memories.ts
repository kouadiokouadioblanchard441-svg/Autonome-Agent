import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const conversationMemoriesTable = pgTable("conversation_memories", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  contactPhone: text("contact_phone"),
  contactUsername: text("contact_username"),
  contactName: text("contact_name"),
  topics: text("topics").default("[]"), // JSON string[]
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at"),
  interestLevel: text("interest_level").notNull().default("cold"), // cold | warm | hot
  detectedLanguage: text("detected_language"),
  notes: text("notes"),
  keyFacts: text("key_facts").default("[]"), // JSON string[]
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
