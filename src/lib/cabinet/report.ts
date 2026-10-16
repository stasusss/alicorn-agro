import { getDb } from "@/db";
import { organizations, readings, sensors } from "@/db/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";

const IDEAL = {
  temperature: { min: 18, max: 26 },
  humidity: { min: 55, max: 85 },
  vpd: { min: 0.6, max: 1.3 },
};

const ZONE_TEMP_DELTA = 1.0; // °C vs greenhouse average
const PROBLEM_SHARE = 0.2; // 20% of samples outside ideal → problem zone

export type ReportSensorStats = {
  sensorId: string;
  name: string;
  count: number;
  avgTemp: number;
  avgHumidity: number;
  avgVpd: number;
  avgDewPoint: number;
  minTemp: number;
  maxTemp: number;
  outsideIdealShare: number;
  tempDeltaFromMean: number;
};

export type ProblemZone = {
  name: string;
  reasons: string[];
};

export type ProblemPeriod = {
  from: string;
  to: string;
  label: string;
  detail: string;
};

export type AnalyticsReport = {
  organizationName: string;
  from: string;
  to: string;
  generatedAt: string;
  sampleCount: number;
  overall: {
    avgTemp: number;
    avgHumidity: number;
    avgVpd: number;
    avgDewPoint: number;
    minTemp: number;
    maxTemp: number;
  };
  sensors: ReportSensorStats[];
  problemZones: ProblemZone[];
  problemPeriods: ProblemPeriod[];
  conclusion: string;
};

function avg(nums: number[]) {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function hourKey(d: Date) {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  return x.toISOString();
}

function outsideIdeal(
  t: number,
  h: number,
  v: number,
): Array<"temperature" | "humidity" | "vpd"> {
  const flags: Array<"temperature" | "humidity" | "vpd"> = [];
  if (t < IDEAL.temperature.min || t > IDEAL.temperature.max) flags.push("temperature");
  if (h < IDEAL.humidity.min || h > IDEAL.humidity.max) flags.push("humidity");
  if (v < IDEAL.vpd.min || v > IDEAL.vpd.max) flags.push("vpd");
  return flags;
}

function buildConclusion(report: Omit<AnalyticsReport, "conclusion">): string {
  const parts: string[] = [];
  const { overall, problemZones, problemPeriods, sampleCount } = report;

  if (sampleCount === 0) {
    return "За вибраний період немає даних з датчиків. Перевірте роботу шлюзу та наявність вимірювань.";
  }

  parts.push(
    `За період середня температура склала ${round1(overall.avgTemp)} °C, вологість ${round1(overall.avgHumidity)} %, VPD ${round2(overall.avgVpd)} kPa.`,
  );

  const tOk =
    overall.avgTemp >= IDEAL.temperature.min && overall.avgTemp <= IDEAL.temperature.max;
  const hOk =
    overall.avgHumidity >= IDEAL.humidity.min && overall.avgHumidity <= IDEAL.humidity.max;
  const vOk = overall.avgVpd >= IDEAL.vpd.min && overall.avgVpd <= IDEAL.vpd.max;

  if (tOk && hOk && vOk && problemZones.length === 0 && problemPeriods.length === 0) {
    parts.push(
      "Загалом мікроклімат виглядає стабільним: середні показники в комфортному діапазоні, виражених проблемних зон і періодів не виявлено.",
    );
  } else {
    if (!tOk) {
      parts.push(
        overall.avgTemp < IDEAL.temperature.min
          ? "Середня температура нижча за комфортний діапазон — варто перевірити обігрів і нічні провали."
          : "Середня температура вища за комфортний діапазон — зверніть увагу на вентиляцію та затінення в пікові години.",
      );
    }
    if (!vOk) {
      parts.push(
        overall.avgVpd < IDEAL.vpd.min
          ? "Низький VPD вказує на «важке» вологе підвітря — ризик хвороб і слабкої транспірації."
          : "Підвищений VPD свідчить про сухіший режим — рослини можуть відчувати водний стрес.",
      );
    }
    if (problemZones.length > 0) {
      const names = problemZones
        .slice(0, 3)
        .map((z) => z.name)
        .join(", ");
      parts.push(
        `Найбільш проблемні зони: ${names}${problemZones.length > 3 ? " та інші" : ""}. Рекомендуємо перевірити циркуляцію повітря і розташування датчиків у цих точках.`,
      );
    }
    if (problemPeriods.length > 0) {
      parts.push(
        `Виявлено ${problemPeriods.length} проблемних інтервал(ів) у часі — деталі в розділі нижче. Звірте їх із роботою вентиляції/обігріву.`,
      );
    }
  }

  parts.push(
    "Це автоматичний огляд для оперативного контролю; для агрономічних рішень варто враховувати культуру, фазу росту та технологічну карту.",
  );

  return parts.join(" ");
}

export async function buildAnalyticsReport(
  organizationId: string,
  from: Date,
  to: Date,
): Promise<AnalyticsReport> {
  const db = await getDb();
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  const orgSensors = await db
    .select()
    .from(sensors)
    .where(and(eq(sensors.organizationId, organizationId), eq(sensors.active, true)))
    .orderBy(asc(sensors.name));

  const rows = await db
    .select({
      sensorId: readings.sensorId,
      ts: readings.ts,
      temperature: readings.temperature,
      humidity: readings.humidity,
      vpd: readings.vpd,
      dewPoint: readings.dewPoint,
    })
    .from(readings)
    .where(
      and(
        eq(readings.organizationId, organizationId),
        gte(readings.ts, from),
        lte(readings.ts, to),
      ),
    )
    .orderBy(asc(readings.ts));

  const nameById = new Map(orgSensors.map((s) => [s.id, s.name]));
  const bySensor = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = bySensor.get(row.sensorId) ?? [];
    list.push(row);
    bySensor.set(row.sensorId, list);
  }

  const allTemps = rows.map((r) => r.temperature);
  const allHum = rows.map((r) => r.humidity);
  const allVpd = rows.map((r) => r.vpd);
  const allDew = rows.map((r) => r.dewPoint);
  const meanTemp = avg(allTemps) ?? 0;

  const sensorStats: ReportSensorStats[] = orgSensors
    .map((s) => {
      const list = bySensor.get(s.id) ?? [];
      if (list.length === 0) return null;
      const temps = list.map((r) => r.temperature);
      const hums = list.map((r) => r.humidity);
      const vpds = list.map((r) => r.vpd);
      const dews = list.map((r) => r.dewPoint);
      const outside = list.filter(
        (r) => outsideIdeal(r.temperature, r.humidity, r.vpd).length > 0,
      ).length;
      const avgT = avg(temps)!;
      return {
        sensorId: s.id,
        name: s.name,
        count: list.length,
        avgTemp: round1(avgT),
        avgHumidity: round1(avg(hums)!),
        avgVpd: round2(avg(vpds)!),
        avgDewPoint: round1(avg(dews)!),
        minTemp: round1(Math.min(...temps)),
        maxTemp: round1(Math.max(...temps)),
        outsideIdealShare: round2(outside / list.length),
        tempDeltaFromMean: round1(avgT - meanTemp),
      };
    })
    .filter((x): x is ReportSensorStats => x !== null);

  const problemZones: ProblemZone[] = [];
  for (const s of sensorStats) {
    const reasons: string[] = [];
    if (Math.abs(s.tempDeltaFromMean) >= ZONE_TEMP_DELTA) {
      reasons.push(
        s.tempDeltaFromMean > 0
          ? `тепліша за середню по теплиці на ${s.tempDeltaFromMean} °C`
          : `холодніша за середню по теплиці на ${Math.abs(s.tempDeltaFromMean)} °C`,
      );
    }
    if (s.outsideIdealShare >= PROBLEM_SHARE) {
      reasons.push(
        `${Math.round(s.outsideIdealShare * 100)}% вимірювань поза комфортним діапазоном (T/RH/VPD)`,
      );
    }
    if (s.avgVpd < IDEAL.vpd.min) reasons.push(`низький середній VPD (${s.avgVpd} kPa)`);
    if (s.avgVpd > IDEAL.vpd.max) reasons.push(`високий середній VPD (${s.avgVpd} kPa)`);
    if (reasons.length > 0) {
      problemZones.push({ name: s.name, reasons });
    }
  }

  // Hourly problem periods across all sensors
  const hourBuckets = new Map<
    string,
    { temps: number[]; hums: number[]; vpds: number[] }
  >();
  for (const row of rows) {
    const key = hourKey(row.ts);
    const bucket = hourBuckets.get(key) ?? { temps: [], hums: [], vpds: [] };
    bucket.temps.push(row.temperature);
    bucket.hums.push(row.humidity);
    bucket.vpds.push(row.vpd);
    hourBuckets.set(key, bucket);
  }

  const problemPeriods: ProblemPeriod[] = [];
  const sortedHours = [...hourBuckets.keys()].sort();
  for (const key of sortedHours) {
    const b = hourBuckets.get(key)!;
    const t = avg(b.temps)!;
    const h = avg(b.hums)!;
    const v = avg(b.vpds)!;
    const issues: string[] = [];
    if (t < 16) issues.push(`низька T (${round1(t)} °C)`);
    if (t > 28) issues.push(`висока T (${round1(t)} °C)`);
    if (h > 90) issues.push(`дуже висока RH (${round1(h)} %)`);
    if (h < 45) issues.push(`низька RH (${round1(h)} %)`);
    if (v < 0.4) issues.push(`низький VPD (${round2(v)} kPa)`);
    if (v > 1.5) issues.push(`високий VPD (${round2(v)} kPa)`);
    if (issues.length === 0) continue;

    const start = new Date(key);
    const end = new Date(start.getTime() + 60 * 60_000);
    problemPeriods.push({
      from: start.toISOString(),
      to: end.toISOString(),
      label: start.toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" }),
      detail: issues.join("; "),
    });
  }

  const draft: Omit<AnalyticsReport, "conclusion"> = {
    organizationName: org?.name ?? "Теплиця",
    from: from.toISOString(),
    to: to.toISOString(),
    generatedAt: new Date().toISOString(),
    sampleCount: rows.length,
    overall: {
      avgTemp: round1(avg(allTemps) ?? 0),
      avgHumidity: round1(avg(allHum) ?? 0),
      avgVpd: round2(avg(allVpd) ?? 0),
      avgDewPoint: round1(avg(allDew) ?? 0),
      minTemp: allTemps.length ? round1(Math.min(...allTemps)) : 0,
      maxTemp: allTemps.length ? round1(Math.max(...allTemps)) : 0,
    },
    sensors: sensorStats,
    problemZones,
    problemPeriods,
  };

  return { ...draft, conclusion: buildConclusion(draft) };
}

function esc(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderReportHtml(report: AnalyticsReport): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" });

  const zoneRows =
    report.problemZones.length === 0
      ? `<p class="muted">Виражених проблемних зон не виявлено.</p>`
      : `<ul>${report.problemZones
          .map(
            (z) =>
              `<li><strong>${esc(z.name)}</strong> — ${esc(z.reasons.join("; "))}</li>`,
          )
          .join("")}</ul>`;

  const periodRows =
    report.problemPeriods.length === 0
      ? `<p class="muted">Проблемних годинних інтервалів не виявлено.</p>`
      : `<table><thead><tr><th>Період</th><th>Що не так</th></tr></thead><tbody>${report.problemPeriods
          .map(
            (p) =>
              `<tr><td>${esc(p.label)}</td><td>${esc(p.detail)}</td></tr>`,
          )
          .join("")}</tbody></table>`;

  const sensorRows = report.sensors
    .map(
      (s) => `<tr>
        <td>${esc(s.name)}</td>
        <td>${s.avgTemp}</td>
        <td>${s.avgHumidity}</td>
        <td>${s.avgVpd}</td>
        <td>${s.avgDewPoint}</td>
        <td>${s.minTemp} … ${s.maxTemp}</td>
        <td>${Math.round(s.outsideIdealShare * 100)}%</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <title>Звіт — ${esc(report.organizationName)}</title>
  <style>
    :root { color-scheme: light; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      margin: 0; padding: 48px 24px; background: #f5f5f7; color: #1d1d1f; line-height: 1.45; }
    .wrap { max-width: 820px; margin: 0 auto; background: #fff; border-radius: 20px;
      padding: 40px 36px; border: 1px solid rgba(0,0,0,.08); }
    h1 { font-size: 28px; letter-spacing: -.03em; margin: 0 0 8px; }
    h2 { font-size: 18px; letter-spacing: -.02em; margin: 32px 0 12px; }
    .muted { color: #86868b; font-size: 14px; }
    .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 20px; }
    @media (min-width: 640px) { .grid { grid-template-columns: repeat(4, 1fr); } }
    .card { background: #fbfbfd; border: 1px solid rgba(0,0,0,.06); border-radius: 14px; padding: 14px 16px; }
    .card b { display: block; font-size: 22px; letter-spacing: -.02em; margin-top: 4px; }
    .card span { font-size: 12px; color: #86868b; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid rgba(0,0,0,.06); }
    th { color: #86868b; font-weight: 500; }
    .conclusion { background: #f5f5f7; border-radius: 14px; padding: 18px 20px; font-size: 15px; }
    ul { padding-left: 18px; }
    li { margin: 6px 0; }
    .footer { margin-top: 36px; font-size: 12px; color: #86868b; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Аналітичний звіт</h1>
    <p class="muted">${esc(report.organizationName)} · період ${esc(fmt(report.from))} — ${esc(fmt(report.to))}<br/>
    Згенеровано ${esc(fmt(report.generatedAt))} · вимірювань: ${report.sampleCount}</p>

    <h2>Середні показники</h2>
    <div class="grid">
      <div class="card"><span>Температура</span><b>${report.overall.avgTemp} °C</b></div>
      <div class="card"><span>Вологість</span><b>${report.overall.avgHumidity} %</b></div>
      <div class="card"><span>VPD</span><b>${report.overall.avgVpd} kPa</b></div>
      <div class="card"><span>Точка роси</span><b>${report.overall.avgDewPoint} °C</b></div>
    </div>
    <p class="muted" style="margin-top:12px">Діапазон T: ${report.overall.minTemp} … ${report.overall.maxTemp} °C.
      Орієнтир комфорту: T ${IDEAL.temperature.min}–${IDEAL.temperature.max} °C, RH ${IDEAL.humidity.min}–${IDEAL.humidity.max} %, VPD ${IDEAL.vpd.min}–${IDEAL.vpd.max} kPa.</p>

    <h2>По датчиках</h2>
    ${
      report.sensors.length === 0
        ? `<p class="muted">Немає даних.</p>`
        : `<table><thead><tr>
            <th>Датчик</th><th>T °C</th><th>RH %</th><th>VPD</th><th>Dew</th><th>T min…max</th><th>Поза нормою</th>
          </tr></thead><tbody>${sensorRows}</tbody></table>`
    }

    <h2>Проблемні зони</h2>
    ${zoneRows}

    <h2>Проблемні періоди</h2>
    ${periodRows}

    <h2>Висновок</h2>
    <div class="conclusion">${esc(report.conclusion)}</div>

    <p class="footer">Alicorn Agro · автоматичний звіт кабінету телеметрії</p>
  </div>
</body>
</html>`;
}
