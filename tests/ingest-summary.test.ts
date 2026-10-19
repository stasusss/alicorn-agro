import { parseIngestSummary, summarizeIngestBatch } from "@/lib/ingest-log";
import { describe, expect, it } from "vitest";

describe("ingest batch summary", () => {
  it("counts sensors, spans time, and lists unknown ids once", () => {
    const summary = summarizeIngestBatch(
      [
        { sensor_external_id: "s102", ts: "2026-10-19T12:00:15.000Z" },
        { sensor_external_id: "s101", ts: "2026-10-19T12:00:00.000Z" },
        { sensor_external_id: "s101", ts: "2026-10-19T12:00:30.000Z" },
      ],
      ["s999", "s999"],
    );
    expect(summary.sensors).toEqual([
      { id: "s101", count: 2 },
      { id: "s102", count: 1 },
    ]);
    expect(summary.tsFrom).toBe("2026-10-19T12:00:00.000Z");
    expect(summary.tsTo).toBe("2026-10-19T12:00:30.000Z");
    expect(summary.unknownSensors).toEqual(["s999"]);
  });

  it("returns an empty summary for a corrupt stored row", () => {
    expect(parseIngestSummary("not-json")).toEqual({
      sensors: [],
      unknownSensors: [],
      tsFrom: null,
      tsTo: null,
    });
  });
});
