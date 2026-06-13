import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const autoJoinTargetsTable = pgTable("auto_join_targets", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  keywords: text("keywords").notNull().default("[]"), // JSON string[]
  targetType: text("target_type").notNull().default("group"), // group | channel | both
  status: text("status").notNull().default("active"), // active | paused | completed
  dailyJoinLimit: integer("daily_join_limit").notNull().default(2),
  joinedToday: integer("joined_today").notNull().default(0),
  totalJoined: integer("total_joined").notNull().default(0),
  maxTotal: integer("max_total").notNull().default(20),
  foundGroups: text("found_groups").default("[]"), // JSON {title,username,memberCount}[]
  scrapeMembers: boolean("scrape_members").notNull().default(true),
  minMemberCount: integer("min_member_count").notNull().default(100),
  lastScanAt: timestamp("last_scan_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
