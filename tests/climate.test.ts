import { computeDerivedMetrics, dewPointC, saturationVaporPressureKPa, vaporPressureDeficit } from "@/lib/climate";
import { describe, expect, it } from "vitest";

describe("climate formulas", () => {
  it("matches the Magnus VPD curve", () => {
    const vpdAt25 = 0.6108 * Math.exp((17.27 * 25) / (25 + 237.3)) * (1 - 60 / 100);
    expect(vaporPressureDeficit(25, 60)).toBeCloseTo(vpdAt25, 8);
    expect(vaporPressureDeficit(20, 100)).toBe(0);
    expect(vaporPressureDeficit(20, 150)).toBe(0);
    expect(saturationVaporPressureKPa(25)).toBeCloseTo(vaporPressureDeficit(25, 0), 8);
  });

  it("matches the dew-point curve and rounds derived metrics", () => {
    const gamma = Math.log(60 / 100) + (17.27 * 25) / (25 + 237.3);
    const dewAt25 = (237.3 * gamma) / (17.27 - gamma);
    expect(dewPointC(25, 60)).toBeCloseTo(dewAt25, 8);
    expect(dewPointC(20, 100)).toBeCloseTo(20, 8);
    expect(Number.isFinite(dewPointC(20, 0))).toBe(true);

    const derived = computeDerivedMetrics(25, 60);
    expect(derived.vpd).toBe(Math.round(vaporPressureDeficit(25, 60) * 1000) / 1000);
    expect(derived.dewPoint).toBe(Math.round(dewPointC(25, 60) * 1000) / 1000);
  });
});
