import { getDayNightWindow, getUtcDayBounds } from "@/lib/sun";
import { describe, expect, it } from "vitest";

describe("sun windows", () => {
  it("puts sunrise before sunset for Kyiv in June", () => {
    const window = getDayNightWindow(new Date("2026-06-21T09:00:00.000Z"), 50.45, 30.52);
    expect(window.sunrise.getTime()).toBeLessThan(window.sunset.getTime());
    expect(window.previousSunset.getTime()).toBeLessThan(window.sunrise.getTime());
  });

  it("returns local midnight in UTC for Europe/Kyiv", () => {
    const winter = getUtcDayBounds(new Date("2026-01-15T22:30:00.000Z"), "Europe/Kyiv");
    expect(winter.start.toISOString()).toBe("2026-01-15T22:00:00.000Z");
    expect(winter.end.toISOString()).toBe("2026-01-16T22:00:00.000Z");

    const summer = getUtcDayBounds(new Date("2026-07-15T21:30:00.000Z"), "Europe/Kyiv");
    expect(summer.start.toISOString()).toBe("2026-07-15T21:00:00.000Z");
    expect(summer.end.toISOString()).toBe("2026-07-16T21:00:00.000Z");
  });
});
