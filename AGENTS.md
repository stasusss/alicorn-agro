<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Деплой

Один розробник. Працюй у `main` і пуш туди: після тестів це одразу викладка на Hetzner. Гілку `dev` і Vercel чіпай лише для складної зміни або нового функціоналу, який може зламати бойовий сайт. Деталі в `docs/deploy.md`, розділ «Гілки і база». Не пропонуй інший порядок.
