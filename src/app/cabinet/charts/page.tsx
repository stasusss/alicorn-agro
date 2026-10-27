import { MetricChart } from "@/components/cabinet/metric-chart";
import { auth } from "@/lib/auth";
import { getOrgSensors } from "@/lib/cabinet/queries";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Графіки",
};

export default async function ChartsPage() {
  const session = await auth();
  if (!session?.user?.organizationId) redirect("/login");
  if (session.user.role === "staff") redirect("/cabinet/chats");
  if (session.user.role === "admin") redirect("/cabinet");

  const sensors = await getOrgSensors(session.user.organizationId);
  const sensorOptions = sensors.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="space-y-10">
      <header className="max-w-2xl">
        <h1 className="cab-title">Графіки</h1>
        <p className="cab-subtitle">
          Кожна точка — згладжене середнє за 5 хвилин. Оберіть датчик або накладіть усі серії
          для порівняння зон теплиці.
        </p>
      </header>
      <div className="space-y-5">
        <MetricChart metric="temperature" sensors={sensorOptions} />
        <MetricChart metric="humidity" sensors={sensorOptions} />
        <MetricChart metric="vpd" sensors={sensorOptions} />
        <MetricChart metric="dew_point" sensors={sensorOptions} />
      </div>
    </div>
  );
}
