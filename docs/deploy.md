# Деплой на Hetzner (Neon + alicorn-agro.com)

Стек: один VPS → Docker Compose (`app` + `caddy`) → Neon Postgres. Базу на Hetzner не переносимо.

## Файли в репозиторії

| Файл | Роль |
| --- | --- |
| `Dockerfile` | multi-stage build, Next.js `standalone`, Node 22 |
| `docker-compose.yml` | `app` + `caddy`, healthcheck, log rotation |
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
   - порт **3000** не відкривати
3. Записати публічний IPv4 (і IPv6, якщо є).

## 2. DNS

У реєстратора домену `alicorn-agro.com`:

- `A` `alicorn-agro.com` → IP VPS
- `A` `www.alicorn-agro.com` → IP VPS
- за наявності IPv6 — відповідні `AAAA`

Перед cutover бажано TTL ≤ 300. Перевірка: `dig +short alicorn-agro.com A`.

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

Скрипт відхилить плейсхолдери й збере `.env.production.hetzner` з `AUTH_URL=https://alicorn-agro.com`.

Мінімум у `/opt/alicorn/.env` на сервері:

```env
DATABASE_URL=postgresql://...@....neon.tech/...?sslmode=require
AUTH_SECRET=...
AUTH_URL=https://alicorn-agro.com
TELEGRAM_BOT_TOKEN=...
RESEND_API_KEY=...
ALERT_EMAIL_FROM=alerts@alicorn-agro.com
```

```bash
chmod 600 /opt/alicorn/.env
```

`AUTH_URL` має бути саме `https://alicorn-agro.com` (без слеша в кінці). Домен відправника має бути верифікований у Resend.

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
./scripts/deploy/verify-cutover.sh https://alicorn-agro.com
```

Вручну:

1. Логін у `/cabinet`, charts / heatmap / export / report
2. Ingest: `BASE_URL=https://alicorn-agro.com GATEWAY_ID=… GATEWAY_API_KEY=… npm run test:ingest`
3. Тестовий alert (Telegram + email)
4. Завантаження `/3dmodel.glb`

Потім перемкнути шлюз(і) на `https://alicorn-agro.com/api/ingest`.

Uptime-монітор (UptimeRobot / Better Stack) → `GET /api/health`.

Vercel залиш на 24–48 год як fallback, потім вимкни.

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

## Troubleshooting

| Симптом | Що перевірити |
| --- | --- |
| Caddy не видає сертифікат | DNS A/AAAA, порти 80/443 у firewall, логи `caddy` |
| `/api/health` → 503 | `DATABASE_URL`, мережа VPS → Neon, логи `app` |
| Логін редіректить на localhost | `AUTH_URL=https://alicorn-agro.com` |
| Ingest 401 | ключ шлюзу / `gateway_id` у тілі запиту |
| Deploy у GitHub червоний одразу | секрети `HETZNER_HOST` і `HETZNER_SSH_KEY`, користувач `deploy` у групі `docker` |
