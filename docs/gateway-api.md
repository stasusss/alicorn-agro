# Gateway → Cloud ingest API

Контракт для LoRa-шлюзу (приймача), який раз на хвилину відправляє batch вимірювань на сервер.

## Endpoint

`POST /api/ingest`

## Auth

```
Authorization: Bearer <GATEWAY_API_KEY>
```

Ключ видається при seed / провізіонінгу шлюзу. У БД зберігається лише hash.

## Body

```json
{
  "gateway_id": "uuid-шлюзу",
  "readings": [
    {
      "sensor_external_id": "s1",
      "ts": "2026-10-16T08:01:00.000Z",
      "temperature": 22.1,
      "humidity": 68.5
    }
  ]
}
```

| Поле | Опис |
| --- | --- |
| `gateway_id` | UUID шлюзу з БД |
| `sensor_external_id` | Стабільний ID датчика на шлюзі (`s1`…`s20`) |
| `ts` | ISO-8601 UTC з мітки часу вимірювання (не час відправки) |
| `temperature` | °C |
| `humidity` | % RH (0–100) |

Ліміт: до **5000** readings за запит (достатньо для backfill буфера 12 год).

## Поведінка сервера

1. Перевіряє API key і `gateway_id`.
2. Рахує **VPD** і **точку роси** на сервері.
3. Вставляє рядки з `ON CONFLICT DO NOTHING` по `(sensor_id, ts)` — повторна відправка буфера безпечна.
4. Оновлює `gateways.last_seen_at`.
5. Перевіряє правила алертів організації.

## Відповідь

```json
{
  "ok": true,
  "received": 20,
  "inserted": 18,
  "skipped_unknown_sensors": 0
}
```

| Код | Значення |
| --- | --- |
| 200 | OK |
| 400 | Невалідний JSON / схема |
| 401 | Немає / невірний ключ |
| 429 | Rate limit (30 req/хв на gateway) |

## Рекомендації для прошивки шлюзу

- Датчики опитуються кожні **15 с** по LoRa; шлюз агрегує і шле на сервер **1 раз / хв**.
- При втраті Wi‑Fi / мобільного інтернету зберігати буфер **≥ 12 годин** з оригінальними `ts`.
- Після відновлення зв’язку відправити буфер чанками (наприклад по 500–1000 readings) з retry + exponential backoff.
- Не змінювати `ts` на час відправки — інакше спотворяться графіки day/night.

## Тест локально

```bash
# після seed:
export GATEWAY_ID=...
export GATEWAY_API_KEY=gw_demo_key_change_me
export BASE_URL=http://localhost:3000
npm run test:ingest
```

Скрипт `scripts/test-ingest.ts` симулює хвилинний batch і backfill з минулого.
