import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const alertChannelEnum = pgEnum("alert_channel", ["telegram", "email"]);
export const alertMetricEnum = pgEnum("alert_metric", [
  "temperature",
  "humidity",
  "vpd",
  "dew_point",
]);
export const alertOperatorEnum = pgEnum("alert_operator", ["gt", "lt", "gte", "lte"]);
export const alertTargetEnum = pgEnum("alert_target", ["sensor", "all_avg"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  timezone: text("timezone").notNull().default("Europe/Kyiv"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const gateways = pgTable(
  "gateways",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    apiKeyHash: text("api_key_hash").notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("gateways_org_idx").on(table.organizationId)],
);

export const sensors = pgTable(
  "sensors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    gatewayId: uuid("gateway_id")
      .notNull()
      .references(() => gateways.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    name: text("name").notNull(),
    positionX: doublePrecision("position_x").notNull().default(0.5),
    positionY: doublePrecision("position_y").notNull().default(0.5),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("sensors_gateway_external_idx").on(table.gatewayId, table.externalId),
    index("sensors_org_idx").on(table.organizationId),
  ],
);

export const ingestLogs = pgTable(
  "ingest_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    gatewayId: uuid("gateway_id")
      .notNull()
      .references(() => gateways.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    receivedAt: timestamp("received_at", { withTimezone: true }).defaultNow().notNull(),
    received: integer("received").notNull(),
    inserted: integer("inserted").notNull(),
    skippedUnknown: integer("skipped_unknown").notNull(),
    tsFrom: timestamp("ts_from", { withTimezone: true }),
    tsTo: timestamp("ts_to", { withTimezone: true }),
    /** JSON: { sensors: {id, count}[], unknownSensors: string[] } */
    summary: text("summary").notNull(),
  },
  (table) => [index("ingest_logs_org_received_idx").on(table.organizationId, table.receivedAt)],
);

export const readings = pgTable(
  "readings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sensorId: uuid("sensor_id")
      .notNull()
      .references(() => sensors.id, { onDelete: "restrict" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    ts: timestamp("ts", { withTimezone: true }).notNull(),
    temperature: doublePrecision("temperature").notNull(),
    humidity: doublePrecision("humidity").notNull(),
    vpd: doublePrecision("vpd").notNull(),
    dewPoint: doublePrecision("dew_point").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("readings_sensor_ts_idx").on(table.sensorId, table.ts),
    index("readings_org_ts_idx").on(table.organizationId, table.ts),
    index("readings_sensor_ts_range_idx").on(table.sensorId, table.ts),
  ],
);

export const alertRules = pgTable(
  "alert_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    channel: alertChannelEnum("channel").notNull(),
    destination: text("destination").notNull(),
    targetType: alertTargetEnum("target_type").notNull(),
    sensorId: uuid("sensor_id").references(() => sensors.id, { onDelete: "cascade" }),
    metric: alertMetricEnum("metric").notNull(),
    operator: alertOperatorEnum("operator").notNull(),
    threshold: doublePrecision("threshold").notNull(),
    cooldownMinutes: integer("cooldown_minutes").notNull().default(30),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("alert_rules_org_idx").on(table.organizationId)],
);

export const alertEvents = pgTable(
  "alert_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    alertRuleId: uuid("alert_rule_id")
      .notNull()
      .references(() => alertRules.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    triggeredAt: timestamp("triggered_at", { withTimezone: true }).defaultNow().notNull(),
    value: doublePrecision("value").notNull(),
    message: text("message").notNull(),
    delivered: boolean("delivered").notNull().default(false),
  },
  (table) => [
    index("alert_events_rule_idx").on(table.alertRuleId, table.triggeredAt),
    index("alert_events_org_idx").on(table.organizationId, table.triggeredAt),
  ],
);

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Gateway = typeof gateways.$inferSelect;
export type Sensor = typeof sensors.$inferSelect;
export type Reading = typeof readings.$inferSelect;
export type AlertRule = typeof alertRules.$inferSelect;
export type AlertEvent = typeof alertEvents.$inferSelect;
