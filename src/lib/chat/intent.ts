const HUMAN_REQUEST =
  /(оператор|спеціаліст|людин|менеджер|зателефону|передзвон|зв['’ʼ]яжіть|звяжіть|подзвон|живий)/i;

const NOT_A_NAME =
  /(розкаж|які|яка|яке|що|як|чи|про|хочу|можна|скільки|послуг|ґрунт|клімат|датчик)/i;

const PHONE_CANDIDATE = /\+?\d[\d\s().-]{8,}\d/g;

export function wantsHuman(text: string) {
  return HUMAN_REQUEST.test(text);
}

export function normalizePhone(digits: string) {
  if (digits.length === 10 && digits.startsWith("0")) return `+38${digits}`;
  if (digits.length === 12 && digits.startsWith("380")) return `+${digits}`;
  if (digits.length >= 10 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function extractPhone(text: string) {
  const matches = text.match(PHONE_CANDIDATE) ?? [];
  for (const match of matches) {
    const phone = normalizePhone(match.replace(/\D/g, ""));
    if (phone) return phone;
  }
  return null;
}

export function extractName(text: string) {
  const labeled = text.match(
    /(?:мене звати|моє ім['’ʼ]я|ім['’ʼ]я)\s*[:\-]?\s*([\p{L}'’ʼ-]{2,}(?:\s+[\p{L}'’ʼ-]{2,}){0,2})/iu,
  );
  if (labeled) return labeled[1].trim();

  const cleaned = text
    .replace(PHONE_CANDIDATE, " ")
    .replace(/[^\p{L}\s'’ʼ-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:мене звати|я)\s+/iu, "")
    .trim();

  if (!cleaned || wantsHuman(cleaned) || NOT_A_NAME.test(cleaned)) return null;
  const words = cleaned.split(" ");
  if (words.length > 3 || words.some((word) => word.length < 2)) return null;
  return cleaned;
}

export function contactRequest(name: string | null, phone: string | null) {
  if (!name && !phone) {
    return "Щоб передати діалог спеціалісту, напишіть ім’я і номер телефону в одному повідомленні.";
  }
  if (!name) return "Дякуємо. Напишіть, будь ласка, як до вас звертатися.";
  return "Дякуємо. Напишіть номер телефону, щоб спеціаліст міг зв’язатися, якщо закриєте вікно.";
}

export const ASSISTANT_CONNECTED =
  "Дякуємо. Спеціаліст підключиться в цьому вікні. Можете дописати деталі запиту.";

export const ASSISTANT_NO_AI =
  "Зараз повідомлення бачить спеціаліст. Напишіть ім’я і телефон, щоб ми могли передзвонити, якщо закриєте вікно.";
