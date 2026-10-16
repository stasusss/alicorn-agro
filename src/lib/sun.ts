import * as SunCalc from "suncalc";

export type DayNightWindow = {
  sunrise: Date;
  sunset: Date;
  /** Previous sunset (start of "night" that ends at today's sunrise). */
  previousSunset: Date;
};

export function getDayNightWindow(date: Date, latitude: number, longitude: number): DayNightWindow {
  const times = SunCalc.getTimes(date, latitude, longitude);
  const previousDay = new Date(date);
  previousDay.setUTCDate(previousDay.getUTCDate() - 1);
  const previousTimes = SunCalc.getTimes(previousDay, latitude, longitude);

  const sunrise = times.sunrise ?? new Date(date);
  const sunset = times.sunset ?? new Date(date.getTime() + 12 * 3600_000);
  const previousSunset =
    previousTimes.sunset ?? new Date(sunrise.getTime() - 12 * 3600_000);

  return { sunrise, sunset, previousSunset };
}

/** Local calendar day bounds in UTC for averaging "today". */
export function getUtcDayBounds(now: Date, timeZone: string): { start: Date; end: Date } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const localDate = formatter.format(now); // YYYY-MM-DD
  // Approximate: find UTC instants that correspond to local midnight by probing
  const start = zonedMidnightToUtc(localDate, timeZone);
  const next = new Date(start);
  next.setUTCDate(next.getUTCDate() + 1);
  // Recompute next local midnight more carefully
  const nextLocal = formatter.format(new Date(start.getTime() + 36 * 3600 * 1000));
  const end = zonedMidnightToUtc(nextLocal, timeZone);
  return { start, end };
}

function zonedMidnightToUtc(ymd: string, timeZone: string): Date {
  // Binary search UTC time whose zoned calendar date is ymd at 00:00
  let lo = Date.parse(`${ymd}T00:00:00.000Z`) - 14 * 3600 * 1000;
  let hi = Date.parse(`${ymd}T00:00:00.000Z`) + 14 * 3600 * 1000;
  const target = `${ymd}T00:00:00`;

  for (let i = 0; i < 48; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(mid));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
    const stamp = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
    if (stamp >= target) hi = mid;
    else lo = mid + 1;
  }
  return new Date(hi);
}
