/**
 * Check the free Neon plan for alicorn-agro and message Telegram
 * when compute, storage, or transfer crosses 70%.
 *
 * NEON_NOTIFY=always sends the report even under the threshold.
 */
const orgId = "org-odd-darkness-35797931";
const computeSizeCu = 0.25;
const limits = {
  cuHours: 100,
  storageBytes: 1024 ** 3,
  transferBytes: 5 * 1024 ** 3,
};

const apiKey = process.env.NEON_API_KEY;
const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

if (!apiKey || !botToken || !chatId) {
  console.error("Set NEON_API_KEY, TELEGRAM_BOT_TOKEN, and TELEGRAM_CHAT_ID.");
  process.exit(1);
}

const response = await fetch(
  `https://console.neon.tech/api/v2/organizations/${orgId}/consumption`,
  { headers: { Authorization: `Bearer ${apiKey}` } },
);
if (!response.ok) {
  console.error("Neon consumption request failed", response.status);
  process.exit(1);
}

const body = await response.json();
const period = body.periods?.[0];
if (!period) {
  console.error("Neon returned no consumption period.");
  process.exit(1);
}

const activeHours = Number(period.active_time) / 3600;
const cuHours = activeHours * computeSizeCu;
const storageBytes = Number(
  period.v3_metrics?.find((metric) => metric.name === "root_branch_logical_size")?.usage ?? 0,
);
const transferBytes = Number(period.data_transfer ?? 0);

const rows = [
  ["Обчислення", cuHours, limits.cuHours, "CU-год"],
  ["Сховище", storageBytes / 1024 ** 2, limits.storageBytes / 1024 ** 2, "МБ"],
  ["Трафік", transferBytes / 1024 ** 3, limits.transferBytes / 1024 ** 3, "ГБ"],
];

function percent(used, limit) {
  return Math.round((used / limit) * 100);
}

const worst = Math.max(...rows.map(([label, used, limit]) => percent(used, limit)));
const alwaysOnDaysLeft = Math.max(0, (limits.cuHours - cuHours) / (computeSizeCu * 24));
const periodEnd = new Date(period.period_end).toLocaleDateString("uk-UA", { timeZone: "Europe/Kyiv" });

const lines = rows.map(([label, used, limit, unit]) => {
  const digits = unit === "CU-год" || unit === "ГБ" ? 1 : 0;
  return `${label}: ${used.toFixed(digits)} з ${limit.toFixed(digits)} ${unit} (${percent(used, limit)}%)`;
});

const report = [
  "Neon alicorn-agro, безкоштовний план.",
  `Період до ${periodEnd}.`,
  ...lines,
  `Якщо обчислення 0.25 CU не засинає, ліміту вистачить ще приблизно на ${alwaysOnDaysLeft.toFixed(1)} доби.`,
  "Коли CU-години закінчаться, база зупиниться до наступного періоду. Дані залишаться.",
].join("\n");

console.log(report);

const shouldSend = process.env.NEON_NOTIFY === "always" || worst >= 70;
if (!shouldSend) process.exit(0);

const sent = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ chat_id: chatId, text: report }),
});
if (!sent.ok) {
  console.error("Telegram send failed", sent.status);
  process.exit(1);
}
console.log("Telegram notification sent.");
