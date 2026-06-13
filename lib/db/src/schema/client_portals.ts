import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const clientPortals = pgTable("client_portals", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ClientPortal = typeof clientPortals.$inferSelect;
export type ClientPortalInsert = typeof clientPortals.$inferInsert;
