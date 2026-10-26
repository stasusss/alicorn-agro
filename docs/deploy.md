# Деплой на Hetzner (Postgres + alicorn-agro.com.ua)

Стек: один VPS → Docker Compose (`postgres` + `app` + `caddy`). Бойова база — Postgres у цьому ж Compose, порт лише на `127.0.0.1` сервера. Neon лишається для dev-сайту на Vercel.

## Файли в репозиторії

| Файл | Роль |
| --- | --- |
| `Dockerfile` | multi-stage build, Next.js `standalone`, Node 22 |
| `docker-compose.yml` | `postgres` + `app` + `caddy`, healthcheck, log rotation |
| `Caddyfile` | TLS, `www` → apex, reverse proxy на `:3000` |
| `scripts/deploy/bootstrap-server.sh` | первинне налаштування Ubuntu 24.04 |
| `scripts/deploy/sync-to-server.sh` | копіювання compose-файлів на VPS |
| `scripts/deploy/verify-cutover.sh` | smoke-перевірки після запуску |

## 1. VPS і firewall (Hetzner Cloud)

1. Створити сервер: Ubuntu 24.04, ~4 GB RAM (CX22/CX23), локація `nbg1` або `fsn1`, SSH-ключ, увімкнути **Backups**.
2. Cloud Firewall:
   - TCP **22** — бажано лише з твого IP
   - TCP **80**, **443**
   - UDP **443** (HTTP/3)
   - порти **3000** і **5432** не відкривати. Postgres слухає лише `127.0.0.1` самого VPS
3. Записати публічний IPv4 (і IPv6, якщо є).

## 2. DNS

У реєстратора домену `alicorn-agro.com.ua`:

- `A` `alicorn-agro.com.ua` → IP VPS
- `A` `www.alicorn-agro.com.ua` → IP VPS
- за наявності IPv6 — відповідні `AAAA`

Перед cutover бажано TTL ≤ 300. Перевірка: `dig +short alicorn-agro.com.ua A`.

Поки DNS ще немає: на сервері лежить тимчасовий `Caddyfile` з `:80` (файл у репо — `Caddyfile.http`). Після DNS:

```bash
ssh deploy@SERVER_IP 'cd /opt/alicorn && cp Caddyfile.production Caddyfile && docker compose restart caddy'
```

## 3. Bootstrap сервера

З машини з SSH-доступом (як `root` один раз):

```bash
scp scripts/deploy/bootstrap-server.sh root@SERVER_IP:/tmp/
ssh root@SERVER_IP 'bash /tmp/bootstrap-server.sh'
```

Скрипт ставить Docker, створює користувача `deploy`, каталог `/opt/alicorn`, вмикає `unattended-upgrades`. Далі логінься як `deploy` (ключ треба додати в `/home/deploy/.ssh/authorized_keys`).

## 4. Production `.env`

`vercel env pull` часто підставляє `[SENSITIVE]` замість реальних секретів. Надійний шлях — скопіювати значення з Vercel Dashboard → Project → Settings → Environment Variables (Production), або з Neon / Resend / Telegram напряму.

Шаблон локально:

```bash
npx vercel env pull .env.production.local --environment=production --yes
# Відредагуй файл: заміни [SENSITIVE] на реальні DATABASE_URL, AUTH_SECRET, TELEGRAM_BOT_TOKEN, RESEND_API_KEY
./scripts/deploy/prepare-env.sh
```

Скрипт відхилить плейсхолдери й збере `.env.production.hetzner` з `AUTH_URL=https://alicorn-agro.com.ua`.

Мінімум у `/opt/alicorn/.env` на сервері:

```env
POSTGRES_USER=alicorn
POSTGRES_PASSWORD=...
POSTGRES_DB=alicorn
DATABASE_URL=postgresql://alicorn:...@postgres:5432/alicorn?sslmode=disable
AUTH_SECRET=...
AUTH_URL=https://alicorn-agro.com.ua
TELEGRAM_BOT_TOKEN=...
RESEND_API_KEY=...
ALERT_EMAIL_FROM=alerts@alicorn-agro.com
```

`DATABASE_URL` всередині Compose вказує на сервіс `postgres`, не на Neon і не на `127.0.0.1`. Пароль у URL має збігатися з `POSTGRES_PASSWORD`. Том змонтований у `/var/lib/postgresql`: образ Postgres 18 так і очікує. Після першого запуску пароль живе в томі `postgres_data`: зміна рядка в `.env` сама по собі пароль у базі не міняє.

```bash
chmod 600 /opt/alicorn/.env
```

`AUTH_URL` має бути саме `https://alicorn-agro.com.ua` (без слеша в кінці). Домен відправника має бути верифікований у Resend.

Перед cutover зніми свіжий дамп Neon (локально, з prod `DATABASE_URL`):

```bash
AGE_RECIPIENT=age1... DATABASE_URL=postgresql://... \
  npm run db:backup -- --out ./backups --skip-upload
```

Міграції на Neon не потрібні — база вже в проді.

## 5. Викладка коду і старт

З кореня репозиторію:

```bash
./scripts/deploy/sync-to-server.sh deploy@SERVER_IP
ssh deploy@SERVER_IP 'cd /opt/alicorn && docker compose up -d --build'
```

Сертифікат Let’s Encrypt з’явиться після того, як DNS уже вказує на VPS. Логи Caddy:

```bash
ssh deploy@SERVER_IP 'cd /opt/alicorn && docker compose logs -f caddy'
```

## 6. Перевірки (cutover)

```bash
./scripts/deploy/verify-cutover.sh https://alicorn-agro.com.ua
```

Вручну:

1. Логін у `/cabinet`, charts / heatmap / export / report
2. Ingest: `BASE_URL=https://alicorn-agro.com.ua GATEWAY_ID=… GATEWAY_API_KEY=… npm run test:ingest`
3. Тестовий alert (Telegram + email)
4. Завантаження `/3dmodel.glb`

Потім перемкнути шлюз(і) на `https://alicorn-agro.com.ua/api/ingest`.

Uptime-монітор (UptimeRobot / Better Stack) → `GET /api/health`.

Vercel лишається dev-сервером, не fallback для домену. Див. розділ 8.

## 7. Автодеплой

Пуш у `main` спочатку проганяє тести. Якщо вони зелені, workflow `deploy` копіює репозиторій на VPS і виконує `docker compose up -d --build`. Файл `/opt/alicorn/.env` на сервері не перезаписується.

Один раз підготуй ключ і секрети GitHub (Settings → Secrets and variables → Actions):

```bash
ssh-keygen -t ed25519 -f hetzner_deploy -N ""
ssh deploy@SERVER_IP 'mkdir -p ~/.ssh && chmod 700 ~/.ssh'
ssh deploy@SERVER_IP 'cat >> ~/.ssh/authorized_keys' < hetzner_deploy.pub
gh secret set HETZNER_HOST --body "SERVER_IP"
gh secret set HETZNER_USER --body "deploy"
gh secret set HETZNER_SSH_KEY < hetzner_deploy
rm hetzner_deploy hetzner_deploy.pub
```

`HETZNER_USER` можна не задавати: тоді використовується `deploy`.

Ручний запасний шлях:

```bash
./scripts/deploy/sync-to-server.sh deploy@SERVER_IP
ssh deploy@SERVER_IP 'cd /opt/alicorn && docker compose up -d --build'
```

## 8. Гілки і база

| Куди пушиш | Що оновлюється |
| --- | --- |
| `dev` | Vercel, https://alicorn-agro-rho.vercel.app. У проєкті Vercel ця гілка стоїть як Production (Settings → Environments → Production → Branch Tracking). |
| `main` | Hetzner, після зелених тестів. Домен `alicorn-agro.com.ua` сюди і веде. |

`output: "standalone"` у `next.config.ts` вмикається лише поза Vercel. На Vercel він ламає збірку, на Hetzner без нього немає Docker-сервера. `AUTH_URL` на Vercel не задавати: інакше вхід у кабінет на `*.vercel.app` перекине на домен замовника.

Бази розділені. Бойові покази, користувачі й шлюзи лежать у Postgres на VPS. Гілка Neon `vercel-dev` лишається копією для Vercel: її connection string стоїть у `DATABASE_URL` середовищ Production і Preview. Запис із dev у бойову базу не потрапляє. Хост `neon.tech` у коді йде через драйвер Neon, будь-який інший Postgres — через звичайний `pg`.

Не підставляй URL Vercel на Hetzner. Нову схему спочатку перевіряй на `vercel-dev`, і лише потім застосовуй до Postgres на сервері.

`GET /api/health` відповідає 200, якщо процес живий, і базу не питає. Docker перевіряє його кожні 30 секунд; якби там був `select 1`, Neon не зміг би заснути. Коли шлюз мовчить, compute засинає за 5 хвилин. Поки датчики шлють пакет щохвилини, база все одно не спить.

Сирі виміри тримаємо 14 днів. Workflow `readings-rollup` щодня о 07:30 UTC заходить на VPS по SSH і згортає старші 5-хвилинні вікна в одну точку тією самою формулою, що й кабінет. Дампи лежать у приватному репозиторії бекапів. На `vercel-dev` не вішати uptime-монітор, інакше dev-гілка Neon не засинатиме.

Бойовий Postgres сидить на диску VPS, окремої плати Neon за нього немає. Neon лишився для `vercel-dev` і на безкоштовному плані засинає, коли dev-сайт ніхто не відкриває: 100 CU-годин, 1 ГБ, 5 ГБ трафіку на проєкт на місяць. Щодня о 07:00 UTC workflow `neon-quota` дивиться це споживання і пише в Telegram Стасу, якщо будь-яка межа вища за 70%. Ручний запуск надсилає звіт завжди. Секрети: `NEON_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

## Troubleshooting

| Симптом | Що перевірити |
| --- | --- |
| Caddy не видає сертифікат | DNS A/AAAA, порти 80/443 у firewall, логи `caddy` |
| Кабінет відкривається, а дані не пишуться | контейнер `postgres` healthy, `DATABASE_URL` вказує на `postgres:5432`, логи `app` |
| Логін редіректить на IP або localhost | `AUTH_URL=https://alicorn-agro.com.ua` |
| Ingest 401 | ключ шлюзу / `gateway_id` у тілі запиту |
| Deploy у GitHub червоний одразу | секрети `HETZNER_HOST` і `HETZNER_SSH_KEY`, користувач `deploy` у групі `docker` |
