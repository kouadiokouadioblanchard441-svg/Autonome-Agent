import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const leadsTable = pgTable("leads", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  contactPhone: text("contact_phone"),
  contactUsername: text("contact_username"),
  contactName: text("contact_name").notNull().default("Unknown"),
  stage: text("stage").notNull().default("cold"), // cold | contacted | interested | negotiating | converted | lost
  campaignId: integer("campaign_id"),
  sourceGroupId: integer("source_group_id"),
  sourceGroupName: text("source_group_name"),
  firstContactAt: timestamp("first_contact_at"),
  lastContactAt: timestamp("last_contact_at"),
  conversionAt: timestamp("conversion_at"),
  messageCount: integer("message_count").notNull().default(0),
  tags: text("tags").default("[]"), // JSON string[]
  notes: text("notes"),
  value: integer("value").default(0), // estimated value in cents
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
