/** Shared comfort bands & status helpers for greenhouse overview. */

export const IDEAL = {
  temperature: { min: 18, max: 26 },
  humidity: { min: 55, max: 85 },
  vpd: { min: 0.6, max: 1.3 },
} as const;

export const ZONE_TEMP_DELTA = 1.0;

export type ZoneIssue = {
  sensorId: string;
  name: string;
  reasons: string[];
  severity: "warn" | "critical";
};

export type OverviewStatus = {
  level: "ok" | "attention" | "critical" | "offline" | "empty";
  title: string;
  detail: string;
  problemZones: ZoneIssue[];
  avgTemp: number | null;
  worstZone: ZoneIssue | null;
};

export type LatestRow = {
  sensorId: string;
  name: string;
  temperature: number | null;
  humidity: number | null;
  vpd: number | null;
  ts: Date | null;
};

export function evaluateOverviewStatus(
  rows: LatestRow[],
  opts?: { gatewayLastSeen?: Date | null; now?: Date },
): OverviewStatus {
  const now = opts?.now ?? new Date();
  const withData = rows.filter((r) => r.temperature !== null && r.ts);

  if (withData.length === 0) {
    return {
      level: "empty",
      title: "Немає даних",
      detail: "Ще немає вимірювань з датчиків за обраний період.",
      problemZones: [],
      avgTemp: null,
      worstZone: null,
    };
  }

  const newest = withData.reduce((a, b) =>
    (a.ts?.getTime() ?? 0) >= (b.ts?.getTime() ?? 0) ? a : b,
  );
  const ageMin = (now.getTime() - (newest.ts?.getTime() ?? now.getTime())) / 60_000;
  const gatewaySeen = opts?.gatewayLastSeen ?? null;

  // Live gateway went silent — only when we previously saw the gateway
  if (gatewaySeen && (now.getTime() - gatewaySeen.getTime()) / 60_000 > 30) {
    return {
      level: "offline",
      title: "Шлюз не на зв’язку",
      detail: `Останній вихід шлюзу ${Math.round((now.getTime() - gatewaySeen.getTime()) / 60_000)} хв тому. Перевірте Wi‑Fi / живлення.`,
      problemZones: [],
      avgTemp: avg(withData.map((r) => r.temperature!)),
      worstZone: null,
    };
  }

  // Fresh ingest expected, but readings are old (and gateway was seen recently or unknown)
  if (gatewaySeen && ageMin > 60) {
    return {
      level: "offline",
      title: "Дані застарілі",
      detail: `Останнє вимірювання ${Math.round(ageMin)} хв тому. Перевірте датчики.`,
      problemZones: [],
      avgTemp: avg(withData.map((r) => r.temperature!)),
      worstZone: null,
    };
  }

  const meanTemp = avg(withData.map((r) => r.temperature!))!;
  const problemZones: ZoneIssue[] = [];

  for (const r of withData) {
    const reasons: string[] = [];
    let severity: "warn" | "critical" = "warn";
    const t = r.temperature!;
    const delta = t - meanTemp;

    if (Math.abs(delta) >= ZONE_TEMP_DELTA) {
      reasons.push(
        delta > 0
          ? `тепліша за середню на ${delta.toFixed(1)} °C`
          : `холодніша за середню на ${Math.abs(delta).toFixed(1)} °C`,
      );
    }
    if (t < 16 || t > 28) {
      reasons.push(`T ${t.toFixed(1)} °C поза безпечним діапазоном`);
      severity = "critical";
    } else if (t < IDEAL.temperature.min || t > IDEAL.temperature.max) {
      reasons.push(`T ${t.toFixed(1)} °C поза комфортом ${IDEAL.temperature.min}–${IDEAL.temperature.max} °C`);
    }
    if (r.vpd !== null) {
      if (r.vpd < 0.4 || r.vpd > 1.5) {
        reasons.push(`VPD ${r.vpd.toFixed(2)} kPa критичний`);
        severity = "critical";
      } else if (r.vpd < IDEAL.vpd.min || r.vpd > IDEAL.vpd.max) {
        reasons.push(`VPD ${r.vpd.toFixed(2)} kPa поза комфортом`);
      }
    }

    if (reasons.length > 0) {
      problemZones.push({
        sensorId: r.sensorId,
        name: r.name,
        reasons,
        severity,
      });
    }
  }

  const critical = problemZones.filter((z) => z.severity === "critical");
  const worstZone =
    critical[0] ??
    problemZones.sort((a, b) => b.reasons.length - a.reasons.length)[0] ??
    null;

  if (critical.length > 0) {
    return {
      level: "critical",
      title: "Потрібна увага",
      detail: `${critical.length} зон(и) з критичними показниками. Найгірша: ${worstZone?.name}.`,
      problemZones,
      avgTemp: meanTemp,
      worstZone,
    };
  }

  if (problemZones.length > 0) {
    return {
      level: "attention",
      title: "Є відхилення",
      detail: `${problemZones.length} зон(и) поза комфортним діапазоном. Перевірте карту нижче.`,
      problemZones,
      avgTemp: meanTemp,
      worstZone,
    };
  }

  const gatewayNote =
    opts?.gatewayLastSeen &&
    now.getTime() - opts.gatewayLastSeen.getTime() > 10 * 60_000
      ? " Шлюз давно не виходив на зв’язок."
      : "";

  return {
    level: "ok",
    title: "Мікроклімат у нормі",
    detail: `Усі зони в комфортному діапазоні. Середня T ${meanTemp.toFixed(1)} °C.${gatewayNote}`,
    problemZones: [],
    avgTemp: meanTemp,
    worstZone: null,
  };
}

function avg(nums: number[]) {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function relativeTimeUk(date: Date | null | undefined, now = new Date()) {
  if (!date) return "немає даних";
  const sec = Math.round((now.getTime() - date.getTime()) / 1000);
  if (sec < 60) return "щойно";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} хв тому`;
  const hours = Math.round(min / 60);
  if (hours < 48) return `${hours} год тому`;
  const days = Math.round(hours / 24);
  return `${days} дн. тому`;
}
