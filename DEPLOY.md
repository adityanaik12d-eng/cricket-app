# Deploying the Cricket App

The app ships as a **single container**: the Fastify server serves both the API
and the built web bundle, and stores everything in one SQLite file. That keeps
deployment simple and cheap — one process, one volume, one URL.

```
Docker image
└─ node server/src/index.ts
   ├─ /                 → web/dist (the React SPA, built by Vite)
   ├─ /matches, /auth…  → the JSON API
   └─ /data/cricket.db  → SQLite (on a mounted volume)
```

Recommended host: **[Fly.io](https://fly.io)** — it builds the `Dockerfile` from
your machine (no Git remote needed), gives a persistent volume for SQLite, and
terminates HTTPS automatically. [Render](https://render.com),
[Railway](https://railway.app), or any VPS with Docker work too, because the
image is generic.

---

## 1. Try the container locally first

With Docker installed:

```bash
docker build -t cricket-app .
docker run --rm -p 3000:3000 -v cricket_data:/data cricket-app
```

Then open <http://localhost:3000>. `http://localhost:3000/healthz` should return
`{"ok":true}`. Create a match from the UI to confirm the API and the SPA are both
being served from the same origin.

Without Docker you can reproduce exactly what the image does:

```bash
npm ci
npm run build                                  # builds packages/core/dist then web/dist
WEB_ROOT=./web/dist DB_PATH=./cricket.db npm start
```

## 2. Deploy to Fly.io

Install the CLI (<https://fly.io/docs/flyctl/install/>) and sign in
(`fly auth signup` / `fly auth login`).

```bash
# From the repo root.
fly launch            # detects the Dockerfile; pick a name + region (e.g. bom/Mumbai)
                      # say NO to a Postgres/Redis add-on — this app only needs SQLite
```

If `fly launch` rewrites `fly.toml`, make sure it still has the `[env]` block
(`DB_PATH=/data/cricket.db`, `WEB_ROOT=/app/web/dist`) and the `[[mounts]]`
section from this repo.

Create the volume that holds the database, then deploy:

```bash
fly volumes create cricket_data --size 1 --region bom
fly deploy
```

Set the one secret the app needs — a long random signing key:

```bash
fly secrets set JWT_SECRET="$(openssl rand -base64 32)"
```

Open the app:

```bash
fly open                # or: fly status --json  →  https://<app>.fly.dev
```

### Custom domain

```bash
fly certs add yourdomain.com
```

Follow the printed DNS records (an `A`/`AAAA` or `CNAME`), then HTTPS is
provisioned automatically.

## 3. Environment variables

| Variable       | Purpose                                   | Default                |
| -------------- | ----------------------------------------- | ---------------------- |
| `PORT`         | HTTP port                                 | `3000`                 |
| `DB_PATH`      | SQLite file location                      | `./cricket.db`         |
| `WEB_ROOT`     | Directory of the built SPA to serve       | *(unset → API only)*   |
| `JWT_SECRET`   | Signing key for sign-in tokens            | `dev-secret-change-me` |
| `OTP_PROVIDER` | OTP delivery; `dev` logs the code server-side | `dev`            |

`JWT_SECRET` **must** be overridden in production. `WEB_ROOT` must point at
`web/dist` for the container to serve the UI (the Dockerfile sets it).

## 4. Backups

All state lives in the single SQLite file on the volume. Back it up with:

```bash
fly ssh console -C "cp /data/cricket.db /data/cricket.db.bak"
fly sftp get /data/cricket.db ./cricket-backup.db
```

For anything beyond a small private beta, take a copy on a schedule and keep it
off the machine.

## 5. Updating

```bash
fly deploy              # rebuilds and rolls out a new machine
```

The volume, and therefore the data, is untouched by deploys.

## 6. Known limitations (read before inviting real users)

- **OTP is development-only.** With `OTP_PROVIDER=dev` the code is printed to the
  server log, not sent as an SMS. Sign-in only works if you can see the logs.
  Anonymous scoring needs no sign-in and works fully.
- **Single instance.** SQLite and the in-process SSE stream assume one running
  machine. Do **not** scale to multiple instances without moving to a shared
  database and a pub/sub layer.
- **No migrations tooling.** Schema changes are applied on startup; keep a backup
  before deploying schema-changing versions.

## 7. Other hosts

Because the image only needs a port and a writable path for `DB_PATH`, it runs
anywhere Docker does:

- **Render:** New → Web Service → Docker; add a Disk mounted at `/data` and set
  `JWT_SECRET`.
- **Railway:** New Project → Deploy from the Dockerfile; add a Volume at `/data`.
- **VPS:** `docker run -d -p 80:3000 -v /srv/cricket:/data -e JWT_SECRET=… cricket-app`
  behind a reverse proxy (Caddy/nginx) for HTTPS.
