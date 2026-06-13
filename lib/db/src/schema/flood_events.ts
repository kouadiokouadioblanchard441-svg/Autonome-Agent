import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const floodEventsTable = pgTable("flood_events", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
  waitSeconds: integer("wait_seconds").notNull(),
  messagesSentBefore: integer("messages_sent_before").notNull().default(0),
  context: text("context"), // which group/channel triggered it
  severity: text("severity").notNull().default("medium"), // low | medium | high | critical
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
