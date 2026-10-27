export function canReadMeasurements(role: string | null | undefined) {
  return role === "client";
}
