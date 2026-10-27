import type { PgliteDatabase } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { applyReadingsSensorRestrict } from "./restrict-readings";
import * as schema from "./schema";

export type Db = PgliteDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __alicornDb?: Db;
  __alicornDbPromise?: Promise<Db>;
};

async function ensurePgliteSchema(db: Db) {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE alert_channel AS ENUM ('telegram', 'email');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE alert_metric AS ENUM ('temperature', 'humidity', 'vpd', 'dew_point');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE alert_operator AS ENUM ('gt', 'lt', 'gte', 'lte');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE alert_target AS ENUM ('sensor', 'all_avg');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS organizations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      latitude double precision NOT NULL,
      longitude double precision NOT NULL,
      timezone text NOT NULL DEFAULT 'Europe/Kyiv',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      email text NOT NULL,
      password_hash text NOT NULL,
      name text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email);`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS gateways (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name text NOT NULL,
      api_key_hash text NOT NULL,
      last_seen_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS gateways_org_idx ON gateways(organization_id);`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sensors (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      gateway_id uuid NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
      external_id text NOT NULL,
      name text NOT NULL,
      position_x double precision NOT NULL DEFAULT 0.5,
      position_y double precision NOT NULL DEFAULT 0.5,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS sensors_gateway_external_idx ON sensors(gateway_id, external_id);
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS sensors_org_idx ON sensors(organization_id);`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS readings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      sensor_id uuid NOT NULL REFERENCES sensors(id) ON DELETE RESTRICT,
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      ts timestamptz NOT NULL,
      temperature double precision NOT NULL,
      humidity double precision NOT NULL,
      vpd double precision NOT NULL,
      dew_point double precision NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS readings_sensor_ts_idx ON readings(sensor_id, ts);
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS readings_org_ts_idx ON readings(organization_id, ts);`);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS readings_sensor_ts_range_idx ON readings(sensor_id, ts);
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ingest_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      gateway_id uuid NOT NULL REFERENCES gateways(id) ON DELETE CASCADE,
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      received_at timestamptz NOT NULL DEFAULT now(),
      received integer NOT NULL,
      inserted integer NOT NULL,
      skipped_unknown integer NOT NULL,
      ts_from timestamptz,
      ts_to timestamptz,
      summary text NOT NULL
    );
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS ingest_logs_org_received_idx ON ingest_logs(organization_id, received_at);
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS alert_rules (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name text NOT NULL,
      channel alert_channel NOT NULL,
      destination text NOT NULL,
      target_type alert_target NOT NULL,
      sensor_id uuid REFERENCES sensors(id) ON DELETE CASCADE,
      metric alert_metric NOT NULL,
      operator alert_operator NOT NULL,
      threshold double precision NOT NULL,
      cooldown_minutes integer NOT NULL DEFAULT 30,
      enabled boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS alert_rules_org_idx ON alert_rules(organization_id);`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS alert_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      alert_rule_id uuid NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
      organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      triggered_at timestamptz NOT NULL DEFAULT now(),
      value double precision NOT NULL,
      message text NOT NULL,
      delivered boolean NOT NULL DEFAULT false
    );
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS alert_events_rule_idx ON alert_events(alert_rule_id, triggered_at);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS alert_events_org_idx ON alert_events(organization_id, triggered_at);
  `);
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE chat_status AS ENUM ('ai', 'human', 'closed');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE chat_role AS ENUM ('visitor', 'assistant', 'staff');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      visitor_token_hash text NOT NULL,
      status chat_status NOT NULL DEFAULT 'ai',
      handoff_requested boolean NOT NULL DEFAULT false,
      visitor_name text,
      visitor_phone text,
      page_url text,
      ip_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      last_message_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS chat_conversations_token_idx ON chat_conversations(visitor_token_hash);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS chat_conversations_ip_created_idx ON chat_conversations(ip_hash, created_at);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS chat_conversations_last_message_idx ON chat_conversations(last_message_at);
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      role chat_role NOT NULL,
      body text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS chat_messages_conversation_idx ON chat_messages(conversation_id, created_at);
  `);
  await ensureOperatorSchema(db);
  await applyReadingsSensorRestrict(db);
}

async function ensureOperatorSchema(db: Db) {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('client', 'admin');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role user_role NOT NULL DEFAULT 'client';
  `);
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE chat_status AS ENUM ('ai', 'human', 'closed');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE chat_role AS ENUM ('visitor', 'assistant', 'staff');
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      visitor_token_hash text NOT NULL,
      status chat_status NOT NULL DEFAULT 'ai',
      handoff_requested boolean NOT NULL DEFAULT false,
      visitor_name text,
      visitor_phone text,
      page_url text,
      ip_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      last_message_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS chat_conversations_token_idx ON chat_conversations(visitor_token_hash);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS chat_conversations_ip_created_idx ON chat_conversations(ip_hash, created_at);
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS chat_conversations_last_message_idx ON chat_conversations(last_message_at);
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
      role chat_role NOT NULL,
      body text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS chat_messages_conversation_idx ON chat_messages(conversation_id, created_at);
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS leads (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      name text NOT NULL,
      phone text NOT NULL,
      email text NOT NULL,
      time text NOT NULL,
      notes text NOT NULL DEFAULT '',
      ip_hash text NOT NULL DEFAULT '',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS leads_created_idx ON leads(created_at);`);
  await db.execute(sql`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'staff'`);
  await db.execute(sql`
    ALTER TABLE chat_conversations
    ADD COLUMN IF NOT EXISTS assigned_user_id uuid REFERENCES users(id) ON DELETE SET NULL
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS chat_conversations_assignee_idx ON chat_conversations(assigned_user_id);
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id text PRIMARY KEY,
      body text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      updated_by uuid REFERENCES users(id) ON DELETE SET NULL
    );
  `);
}

export async function getDb(): Promise<Db> {
  if (globalForDb.__alicornDb) return globalForDb.__alicornDb;
  if (!globalForDb.__alicornDbPromise) {
    globalForDb.__alicornDbPromise = (async () => {
      const url = process.env.DATABASE_URL;
      if (!url) throw new Error("DATABASE_URL is not set");

      if (url.startsWith("pglite:")) {
        const { mkdirSync } = await import("node:fs");
        const { dirname } = await import("node:path");
        const { PGlite } = await import("@electric-sql/pglite");
        const { drizzle } = await import("drizzle-orm/pglite");
        const path = url.replace(/^pglite:/, "") || "./.data/pglite";
        mkdirSync(dirname(path), { recursive: true });
        const client = await PGlite.create(path);
        const db = drizzle(client, { schema }) as unknown as Db;
        await ensurePgliteSchema(db);
        globalForDb.__alicornDb = db;
        return db;
      }

      const host = new URL(url).hostname;
      if (host === "neon.tech" || host.endsWith(".neon.tech")) {
        const { Pool, neonConfig } = await import("@neondatabase/serverless");
        const ws = (await import("ws")).default;
        neonConfig.webSocketConstructor = ws;
        const pool = new Pool({ connectionString: url, max: 1 });
        const { drizzle } = await import("drizzle-orm/neon-serverless");
        const db = drizzle(pool, { schema }) as unknown as Db;
        await ensureOperatorSchema(db);
        globalForDb.__alicornDb = db;
        return db;
      }

      const { Pool } = await import("pg");
      const pool = new Pool({ connectionString: url, max: 10 });
      const { drizzle } = await import("drizzle-orm/node-postgres");
      const db = drizzle(pool, { schema }) as unknown as Db;
      await ensureOperatorSchema(db);
      globalForDb.__alicornDb = db;
      return db;
    })();
  }
  return globalForDb.__alicornDbPromise;
}
