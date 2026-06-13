import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";

export const abTestsTable = pgTable("ab_tests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  campaignId: integer("campaign_id"),
  variantA: text("variant_a").notNull(),
  variantB: text("variant_b").notNull(),
  status: text("status").notNull().default("draft"), // draft | active | completed
  winnerVariant: text("winner_variant"), // a | b | null
  sentA: integer("sent_a").notNull().default(0),
  sentB: integer("sent_b").notNull().default(0),
  repliesA: integer("replies_a").notNull().default(0),
  repliesB: integer("replies_b").notNull().default(0),
  replyRateA: real("reply_rate_a").notNull().default(0),
  replyRateB: real("reply_rate_b").notNull().default(0),
  targetCount: integer("target_count").notNull().default(100),
  confidenceThreshold: real("confidence_threshold").notNull().default(0.95),
  autoSelectWinner: integer("auto_select_winner").notNull().default(1),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
