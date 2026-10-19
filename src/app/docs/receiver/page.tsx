import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Приймач LoRa",
  description:
    "Як LoRa-приймач надсилає виміри датчиків на сервер Alicorn: ідентифікатори, формат пакета, буфер і коди відповіді.",
  robots: { index: false, follow: false },
};

const sensors = [
  ["s101", "s102", "s103", "s104"],
  ["s201", "s202", "s203", "s204"],
  ["s301", "s302", "s303", "s304"],
  ["s401", "s402", "s403", "s404"],
];

const requestExample = `{
  "gateway_id": "00000000-0000-0000-0000-000000000000",
  "readings": [
    {
      "sensor_external_id": "s101",
      "ts": "2026-10-16T09:01:00.000Z",
      "temperature": 22.4,
      "humidity": 71.2
    },
    {
      "sensor_external_id": "s402",
      "ts": "2026-10-16T09:01:15.000Z",
      "temperature": 23.8,
      "humidity": 68.4
    }
  ]
}`;

const responseExample = `{
  "ok": true,
  "received": 64,
  "inserted": 64,
  "skipped_unknown_sensors": 0
}`;

export default function ReceiverDocsPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-forest/10 bg-cream/90 pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-5 sm:px-8">
          <Link href="/" className="font-display text-[15px] font-semibold tracking-tight">
            Alicorn
          </Link>
          <p className="text-[13px] text-ink-muted">Інструкція для приймача</p>
        </div>
      </header>

      <article className="mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-[13px] font-medium tracking-wide text-forest">ClimateGuard</p>
        <h1 className="mt-2 font-display text-[1.85rem] font-semibold leading-tight tracking-tight sm:text-4xl">
          Прийом даних з датчиків
        </h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink-muted">
          Датчики в інтернет не виходять. LoRa-приймач опитує їх і раз на хвилину відправляє пачку
          вимірів на сервер. Нижче — усе, що потрібно прошивці.
        </p>

        <Section id="setup" title="1. Що видає Alicorn до старту">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <Code>gateway_id</Code> — UUID цього приймача.
            </li>
            <li>
              API-ключ. У заголовок іде як <Code>Authorization: Bearer &lt;ключ&gt;</Code>. Ключ
              показують один раз, на сервері лежить лише хеш.
            </li>
            <li>
              Базова адреса сервера. Запит іде на <Code>POST {"{база}"}/api/ingest</Code>.
            </li>
          </ul>
          <p className="mt-4">
            Поки цих трьох значень немає, приймач на об’єкт не вивозять. Демо-ключ з репозиторію
            для живого шлюзу не використовується.
          </p>
        </Section>

        <Section id="ids" title="2. Імена датчиків">
          <p>
            Кожен датчик має стабільний <Code>sensor_external_id</Code>: рядок до 64 символів,
            порівняння чутливе до регістру. <Code>s101</Code>, <Code>S101</Code> і <Code>101</Code>{" "}
            — різні імена. Якщо імені немає в базі цього шлюзу, рядок пропускається, решта пачки
            записується.
          </p>
          <p className="mt-4">
            На цій теплиці шістнадцять точок, чотири ряди по чотири місця. Префікс <Code>s</Code>{" "}
            обов’язковий. Перша цифра — ряд, останні дві — місце в ряду.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-forest/15 text-[12px] tracking-wide text-ink-muted">
                  <th className="py-2 pr-4 font-medium">Ряд</th>
                  <th className="px-3 py-2 font-medium">Місце 1</th>
                  <th className="px-3 py-2 font-medium">Місце 2</th>
                  <th className="px-3 py-2 font-medium">Місце 3</th>
                  <th className="px-3 py-2 font-medium">Місце 4</th>
                </tr>
              </thead>
              <tbody>
                {sensors.map((row, index) => (
                  <tr key={row[0]} className="border-b border-forest/10">
                    <th className="py-2.5 pr-4 font-medium">{index + 1}</th>
                    {row.map((id) => (
                      <td key={id} className="px-3 py-2.5 font-mono text-[13px]">
                        {id}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4">
            Номер на корпусі датчика має збігатися з цим id. <Code>s402</Code> — четвертий ряд,
            друге місце. Новий датчик спочатку заводять у базі з цим id, і лише потім він з’являється
            в пакетах.
          </p>
        </Section>

        <Section id="cadence" title="3. Як часто слати">
          <ul className="list-disc space-y-2 pl-5">
            <li>Опит по LoRa — кожні 15 секунд.</li>
            <li>Відправка на сервер — один запит на хвилину.</li>
            <li>
              У пачці кожен вимір окремим записом. На приймачі не усереднювати: за хвилину виходить
              до чотирьох точок на датчик. Середнє за 5 хвилин рахує сервер і показує в кабінеті.
              Якщо частина пакетів загубилась, вікно ділиться на кількість вимірів, які дійшли.
            </li>
            <li>
              <Code>ts</Code> — час виміру на датчику, не час, коли пакет дійшов до сервера.
            </li>
            <li>Годинник приймача синхронізувати по NTP. Час у UTC, із суфіксом <Code>Z</Code> або явним зсувом.</li>
          </ul>
          <p className="mt-4">
            Для 16 датчиків це близько 64 записів на хвилину. Ліміт сервера — 30 запитів на хвилину
            на один шлюз і до 5000 записів у одному тілі.
          </p>
        </Section>

        <Section id="request" title="4. Запит">
          <pre className="overflow-x-auto rounded-2xl bg-forest-deeper px-4 py-4 text-[13px] leading-relaxed text-cream">
            <code>{`POST /api/ingest
Authorization: Bearer <ключ>
Content-Type: application/json`}</code>
          </pre>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-forest-deeper px-4 py-4 text-[13px] leading-relaxed text-cream">
            <code>{requestExample}</code>
          </pre>
          <p className="mt-4">
            Числа передаються числами, не рядками. Порожню пачку не слати: у тілі має бути хоча б
            один вимір. Окремого heartbeat немає — успішний запит сам оновлює час останнього виходу
            шлюзу.
          </p>
        </Section>

        <Section id="fields" title="5. Поля одного виміру">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-forest/15 text-[12px] tracking-wide text-ink-muted">
                  <th className="py-2 pr-4 font-medium">Поле</th>
                  <th className="px-3 py-2 font-medium">Одиниця</th>
                  <th className="px-3 py-2 font-medium">Правило</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <Field name="sensor_external_id" unit="—" rule="Ім’я з таблиці вище, як є." />
                <Field
                  name="ts"
                  unit="ISO-8601"
                  rule="Час виміру з часовим поясом. Для одного датчика той самий ts вдруге не пишеться."
                />
                <Field name="temperature" unit="°C" rule="Скінченне число." />
                <Field
                  name="humidity"
                  unit="% RH"
                  rule="Від 0 до 100, виміряне значення. Якщо зонд мовчить, датчик з цієї пачки прибрати, нуль не підставляти."
                />
              </tbody>
            </table>
          </div>
          <p className="mt-4">
            VPD і точку роси рахує сервер. У пакет їх не класти. Вологість обов’язкова: без неї
            весь запит відхиляється.
          </p>
        </Section>

        <Section id="response" title="6. Відповідь">
          <pre className="overflow-x-auto rounded-2xl bg-forest-deeper px-4 py-4 text-[13px] leading-relaxed text-cream">
            <code>{responseExample}</code>
          </pre>
          <p className="mt-4">
            <Code>inserted</Code> — нові рядки. Різниця{" "}
            <Code>received − inserted − skipped_unknown_sensors</Code> — повтори, які сервер уже
            мав. Це нормально після досилання буфера.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-forest/15 text-[12px] tracking-wide text-ink-muted">
                  <th className="py-2 pr-4 font-medium">Код</th>
                  <th className="px-3 py-2 font-medium">Що сталося</th>
                  <th className="px-3 py-2 font-medium">Що робити прошивці</th>
                </tr>
              </thead>
              <tbody className="align-top">
                <Status code="200" meaning="Пачку прийнято." action="Зняти ці виміри з буфера. Якщо skipped_unknown_sensors > 0 — виправити імена, не слати їх без кінця." />
                <Status code="400" meaning="JSON або поля не проходять перевірку." action="Той самий пакет не повторювати. Виправити тіло." />
                <Status code="401" meaning="Немає ключа, ключ чужий або gateway_id не той." action="Не ретраїти. Звірити ключ і UUID." />
                <Status code="429" meaning="Більше 30 запитів за хвилину." action="Зачекати і надіслати ту саму пачку ще раз." />
                <Status code="5xx або мережа" meaning="Сервер або канал недоступний." action="Лишити пачку в буфері. Повторити з паузою, що росте." />
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="buffer" title="7. Немає Wi‑Fi або мобільного інтернету">
          <ul className="list-disc space-y-2 pl-5">
            <li>Тримати буфер щонайменше на 12 годин, з оригінальними <Code>ts</Code>.</li>
            <li>Після зв’язку слати буфер шматками по 500–1000 записів.</li>
            <li>Порядок шматків будь-який: повтор того самого <Code>(датчик, ts)</Code> безпечний.</li>
            <li>Вимір зникає з буфера лише після відповіді 200.</li>
            <li>
              <Code>ts</Code> не переписувати на час відправки. Інакше графіки дня і ночі змістяться.
            </li>
          </ul>
        </Section>

        <Section id="check" title="8. Перед увімкненням на об’єкті">
          <ol className="list-decimal space-y-2 pl-5">
            <li>У прошивці прописані бойові <Code>gateway_id</Code>, ключ і адреса, не демо-значення.</li>
            <li>Кожен датчик на мапі відповідає своєму <Code>s101</Code>…<Code>s404</Code>.</li>
            <li>Пробний запит з двома живими вимірами повертає 200 і <Code>inserted: 2</Code>.</li>
            <li>Повтор того самого запиту повертає 200 і <Code>inserted: 0</Code>.</li>
            <li>Запис із невідомим id дає <Code>skipped_unknown_sensors: 1</Code>, інші рядки при цьому зберігаються.</li>
            <li>Після хвилини без мережі буфер доїжджає сам, час точок не змінюється.</li>
          </ol>
        </Section>
      </article>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-20">
      <h2 className="font-display text-[1.35rem] font-semibold tracking-tight">{title}</h2>
      <div className="mt-4 text-[16px] leading-relaxed">{children}</div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-forest/8 px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>
  );
}

function Field({ name, unit, rule }: { name: string; unit: string; rule: string }) {
  return (
    <tr className="border-b border-forest/10">
      <td className="py-2.5 pr-4 font-mono text-[13px]">{name}</td>
      <td className="px-3 py-2.5 whitespace-nowrap">{unit}</td>
      <td className="px-3 py-2.5">{rule}</td>
    </tr>
  );
}

function Status({ code, meaning, action }: { code: string; meaning: string; action: string }) {
  return (
    <tr className="border-b border-forest/10">
      <td className="py-2.5 pr-4 font-mono text-[13px] whitespace-nowrap">{code}</td>
      <td className="px-3 py-2.5">{meaning}</td>
      <td className="px-3 py-2.5">{action}</td>
    </tr>
  );
}
