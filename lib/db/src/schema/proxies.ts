import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const proxiesTable = pgTable("proxies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull(),
  type: text("type").notNull().default("socks5"), // socks5 | http | https
  username: text("username"),
  password: text("password"),
  assignedAccountId: integer("assigned_account_id"),
  isActive: boolean("is_active").notNull().default(true),
  lastCheckedAt: timestamp("last_checked_at"),
  lastCheckStatus: text("last_check_status"), // ok | timeout | banned | error
  responseTimeMs: integer("response_time_ms"),
  failCount: integer("fail_count").notNull().default(0),
  country: text("country"),
  provider: text("provider"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
