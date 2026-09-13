import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

/**
 * Lazy, build-safe database client.
 *
 * Vercel collects page data during `npm run build` by importing every route
 * module. If we validate/create the connection at import time, a missing
 * DATABASE_URL (which isn't needed to *build*) crashes the build with
 * "DATABASE_URL is required". To avoid that we defer all connection work
 * until a query is actually executed at runtime, and only throw then.
 */
const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
  __arenaNextJsPostgresqlDb?: NodePgDatabase;
};

function getPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    // Thrown only when a real request hits the DB at runtime — never at build.
    throw new Error("DATABASE_URL is required");
  }
  if (globalForDb.__arenaNextJsPostgresqlPool) {
    return globalForDb.__arenaNextJsPostgresqlPool;
  }
  const pool = new Pool({ connectionString: databaseUrl });
  globalForDb.__arenaNextJsPostgresqlPool = pool;
  return pool;
}

/** Lazily create (and cache) the Drizzle client on first use. */
function getDb(): NodePgDatabase {
  if (globalForDb.__arenaNextJsPostgresqlDb) {
    return globalForDb.__arenaNextJsPostgresqlDb;
  }
  const instance = drizzle(getPool());
  globalForDb.__arenaNextJsPostgresqlDb = instance;
  return instance;
}

/**
 * `pool` accessor — connects lazily. Safe to import at build time; only
 * touches the environment when a property is actually read at runtime.
 */
export const pool = new Proxy({} as Pool, {
  get(_target, prop, receiver) {
    const realPool = getPool();
    const value = Reflect.get(realPool, prop, receiver);
    return typeof value === "function" ? value.bind(realPool) : value;
  },
});

/**
 * `db` accessor — the Drizzle client, initialized lazily on first query.
 * Importing this module during Vercel's build no longer requires DATABASE_URL;
 * the connection is created only when a route handler runs a query.
 */
export const db = new Proxy({} as NodePgDatabase, {
  get(_target, prop, receiver) {
    const realDb = getDb();
    const value = Reflect.get(realDb, prop, receiver);
    return typeof value === "function" ? value.bind(realDb) : value;
  },
});
