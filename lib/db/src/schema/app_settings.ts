import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value"),
  isSecret: boolean("is_secret").notNull().default(false),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
