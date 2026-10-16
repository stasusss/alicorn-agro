/** Magnus formula constants (Alduchov & Eskridge). */
const A = 17.625;
const B = 243.04;

/** Saturation vapor pressure in kPa from temperature °C. */
export function saturationVaporPressureKPa(temperatureC: number): number {
  return 0.61078 * Math.exp((A * temperatureC) / (B + temperatureC));
}

/** Vapor pressure deficit in kPa. */
export function vaporPressureDeficit(temperatureC: number, relativeHumidity: number): number {
  const es = saturationVaporPressureKPa(temperatureC);
  const ea = es * (relativeHumidity / 100);
  return Math.max(0, es - ea);
}

/** Dew point °C from temperature and RH %. */
export function dewPointC(temperatureC: number, relativeHumidity: number): number {
  const rh = Math.min(100, Math.max(0.01, relativeHumidity));
  const gamma = Math.log(rh / 100) + (A * temperatureC) / (B + temperatureC);
  return (B * gamma) / (A - gamma);
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
