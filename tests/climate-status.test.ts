import { evaluateOverviewStatus, relativeTimeUk } from "@/lib/cabinet/climate-status";
import { describe, expect, it } from "vitest";

const now = new Date("2026-10-19T12:00:00.000Z");

function row(partial: { temperature?: number | null; vpd?: number | null; ts?: Date | null; name?: string }) {
  return {
    sensorId: partial.name ?? "s",
    name: partial.name ?? "Зона",
    temperature: partial.temperature === undefined ? 22 : partial.temperature,
    humidity: 70,
    vpd: partial.vpd === undefined ? 1 : partial.vpd,
    ts: partial.ts === undefined ? now : partial.ts,
  };
}

describe("overview status", () => {
  it("is empty without measurements", () => {
    const status = evaluateOverviewStatus([row({ temperature: null, ts: null })]);
    expect(status.level).toBe("empty");
    expect(status.avgTemp).toBeNull();
  });

  it("is offline when the gateway has been silent for half an hour", () => {
    const status = evaluateOverviewStatus([row({})], {
      now,
      gatewayLastSeen: new Date(now.getTime() - 31 * 60_000),
    });
    expect(status.level).toBe("offline");
  });

  it("marks a dangerous temperature as critical and a comfortable house as ok", () => {
    const critical = evaluateOverviewStatus([row({ temperature: 40, name: "Південь" })], { now });
    expect(critical.level).toBe("critical");
    expect(critical.worstZone?.name).toBe("Південь");

    const ok = evaluateOverviewStatus([row({ temperature: 22, vpd: 1 })], { now });
    expect(ok.level).toBe("ok");
    expect(ok.problemZones).toEqual([]);
  });
});

describe("relativeTimeUk", () => {
  it("labels missing and recent timestamps", () => {
    expect(relativeTimeUk(null, now)).toBe("немає даних");
    expect(relativeTimeUk(new Date(now.getTime() - 30_000), now)).toBe("щойно");
    expect(relativeTimeUk(new Date(now.getTime() - 5 * 60_000), now)).toBe("5 хв тому");
  });
});
