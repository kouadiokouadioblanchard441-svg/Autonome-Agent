import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  console.error(
    "[db] ATTENTION: SUPABASE_DATABASE_URL ou DATABASE_URL non définie — les routes DB retourneront 503."
  );
}

export const pool = connectionString
  ? new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  : null as unknown as pg.Pool;

export const db = connectionString
  ? drizzle(pool, { schema })
  : null as unknown as ReturnType<typeof drizzle>;

export * from "./schema";
