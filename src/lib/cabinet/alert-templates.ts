import type { MetricKey } from "@/lib/climate";

export type AlertTemplate = {
  id: string;
  crop: string;
  name: string;
  metric: MetricKey;
  operator: "gt" | "lt" | "gte" | "lte";
  threshold: number;
  targetType: "all_avg";
  hint: string;
};

/** Ready-made rules a grower can one-tap apply. */
export const ALERT_TEMPLATES: AlertTemplate[] = [
  {
    id: "tomato-hot",
    crop: "Томат",
    name: "Томат: перегрів",
    metric: "temperature",
    operator: "gt",
    threshold: 28,
    targetType: "all_avg",
    hint: "Середня T вище 28 °C",
  },
  {
    id: "tomato-cold",
    crop: "Томат",
    name: "Томат: холод",
    metric: "temperature",
    operator: "lt",
    threshold: 16,
    targetType: "all_avg",
    hint: "Середня T нижче 16 °C",
  },
  {
    id: "cucumber-vpd-high",
    crop: "Огірок",
    name: "Огірок: високий VPD",
    metric: "vpd",
    operator: "gt",
    threshold: 1.3,
    targetType: "all_avg",
    hint: "Сухий режим, ризик стресу",
  },
  {
    id: "cucumber-vpd-low",
    crop: "Огірок",
    name: "Огірок: низький VPD",
    metric: "vpd",
    operator: "lt",
    threshold: 0.5,
    targetType: "all_avg",
    hint: "Вологе підвітря, ризик хвороб",
  },
  {
    id: "seedling-cold",
    crop: "Розсада",
    name: "Розсада: холод",
    metric: "temperature",
    operator: "lt",
    threshold: 18,
    targetType: "all_avg",
    hint: "Не давати просідати нижче 18 °C",
  },
  {
    id: "humidity-high",
    crop: "Загальне",
    name: "Висока вологість",
    metric: "humidity",
    operator: "gt",
    threshold: 88,
    targetType: "all_avg",
    hint: "Увімкнути вентиляцію / осушення",
  },
];
