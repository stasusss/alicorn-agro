import { AlertsPanel } from "@/components/cabinet/alerts-panel";
import { getDb } from "@/db";
import { alertEvents, alertRules } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getOrgSensors } from "@/lib/cabinet/queries";
import type { MetricKey } from "@/lib/climate";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Алерти",
};

export default async function AlertsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");

  const orgId = session.user.organizationId;
  const db = await getDb();
  const [sensors, rules, events] = await Promise.all([
    getOrgSensors(orgId),
    db.select().from(alertRules).where(eq(alertRules.organizationId, orgId)).orderBy(desc(alertRules.createdAt)),
    db
      .select()
      .from(alertEvents)
      .where(eq(alertEvents.organizationId, orgId))
      .orderBy(desc(alertEvents.triggeredAt))
      .limit(50),
  ]);

  return (
    <div className="space-y-10">
      <header className="max-w-2xl">
        <h1 className="cab-title">Алерти</h1>
        <p className="cab-subtitle">
          Telegram або email при виході показників за поріг (датчик або середнє).
        </p>
      </header>
      <AlertsPanel
        sensors={sensors.map((s) => ({ id: s.id, name: s.name }))}
        initialRules={rules.map((r) => ({
          id: r.id,
          name: r.name,
          channel: r.channel,
          destination: r.destination,
          targetType: r.targetType,
          sensorId: r.sensorId,
          metric: r.metric as MetricKey,
          operator: r.operator,
          threshold: r.threshold,
          cooldownMinutes: r.cooldownMinutes,
          enabled: r.enabled,
        }))}
        initialEvents={events.map((e) => ({
          id: e.id,
          message: e.message,
          triggeredAt: e.triggeredAt.toISOString(),
          delivered: e.delivered,
        }))}
      />
    </div>
  );
}
