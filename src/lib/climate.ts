const MAGNUS_A = 17.27;
const MAGNUS_B = 237.3;

/**
 * VPD in kPa.
 * 0.6108 × exp(17.27 × T / (T + 237.3)) × (1 − RH / 100)
 */
export function vaporPressureDeficit(temperatureC: number, relativeHumidity: number): number {
  const saturation =
    0.6108 * Math.exp((MAGNUS_A * temperatureC) / (temperatureC + MAGNUS_B));
  return Math.max(0, saturation * (1 - relativeHumidity / 100));
}

/** Saturation vapor pressure in kPa from temperature °C. Same curve as VPD. */
export function saturationVaporPressureKPa(temperatureC: number): number {
  return vaporPressureDeficit(temperatureC, 0);
}

/**
 * Dew point °C.
 * γ = ln(RH/100) + 17.27 × T / (T + 237.3)
 * Td = 237.3 × γ / (17.27 − γ)
 */
export function dewPointC(temperatureC: number, relativeHumidity: number): number {
  const rh = Math.min(100, Math.max(0.01, relativeHumidity));
  const gamma = Math.log(rh / 100) + (MAGNUS_A * temperatureC) / (temperatureC + MAGNUS_B);
  return (MAGNUS_B * gamma) / (MAGNUS_A - gamma);
}

export function computeDerivedMetrics(temperatureC: number, relativeHumidity: number) {
  return {
    vpd: round3(vaporPressureDeficit(temperatureC, relativeHumidity)),
    dewPoint: round3(dewPointC(temperatureC, relativeHumidity)),
  };
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

export type MetricKey = "temperature" | "humidity" | "vpd" | "dew_point";

export const metricLabels: Record<MetricKey, string> = {
  temperature: "Температура",
  humidity: "Вологість",
  vpd: "VPD",
  dew_point: "Точка роси",
};

export const metricUnits: Record<MetricKey, string> = {
  temperature: "°C",
  humidity: "%",
  vpd: "kPa",
  dew_point: "°C",
};
