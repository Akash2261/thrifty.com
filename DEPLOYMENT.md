# Deploying the Thrifty backend

> **Not yet tested against a real build.** This sandbox has no Docker daemon available, so the
> `Dockerfile` below has been written carefully (matches the npm-workspaces layout, mirrors the
> existing `prisma:generate`/`build` scripts) but never actually built. Run
> `docker build -t thrifty-server -f Dockerfile .` **from the repo root** once, locally, before
> pointing a real host at it — fix forward from whatever it reports rather than assuming it's
> correct.

The mobile app can't reach anything until this exists — every EAS build profile besides
`development` points at a placeholder URL in [apps/mobile/eas.json](apps/mobile/eas.json) until you
deploy this and drop the real URL in.

## What you're deploying

`apps/server` — a Fastify + Prisma/Postgres API. It needs:
- A Postgres database (Redis is optional — only required for background email-sync polling)
- The env vars in [apps/server/.env.example](apps/server/.env.example) (start with just the
  "Required to boot" section; everything else is a real 503/inert feature until configured, not a
  boot-time requirement)
- A migration step (`prisma migrate deploy`) before each new version starts serving traffic

The `Dockerfile` at the repo root handles the build + migration-on-boot in one image. Build context
must be the **repo root**, not `apps/server` — the server depends on the `packages/shared` npm
workspace.

## Generate real secrets first

```bash
openssl rand -hex 32   # JWT_ACCESS_SECRET
openssl rand -hex 32   # JWT_REFRESH_SECRET (must differ from the access secret)
openssl rand -hex 32   # ENCRYPTION_KEY
```

## Option A — Fly.io (Docker-native, simplest)

```bash
fly launch --no-deploy   # detects the Dockerfile, creates fly.toml — pick a Postgres add-on when asked
fly secrets set DATABASE_URL=... JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=... ANTHROPIC_API_KEY=...
fly deploy
```

## Option B — Railway

Railway builds directly from the `Dockerfile` it finds at the repo root. Add a Postgres plugin from
their dashboard (sets `DATABASE_URL` automatically), then add the rest of the required env vars
under the service's Variables tab. Redeploys re-run the `CMD` (migrate + start) automatically.

## Option C — Render

Create a new **Web Service** from this repo, set:
- Runtime: **Docker**
- Dockerfile path: `Dockerfile`
- Docker build context: `.` (repo root)

Add a managed Postgres instance from Render's dashboard and copy its connection string into
`DATABASE_URL`.

## Option D — any Docker-capable VPS

```bash
docker build -t thrifty-server -f Dockerfile .
docker run -d -p 4000:4000 --env-file apps/server/.env thrifty-server
```

Put a reverse proxy (Caddy/nginx) in front for HTTPS — Play Store policy and most OAuth providers
(Google/Microsoft) require the callback URLs to be HTTPS in production.

## After it's deployed

1. Hit `GET https://your-domain/health` — should return `{"status":"ok"}`.
2. Put the real URL into `apps/mobile/eas.json`'s `preview`/`production` build profiles, replacing
   `REPLACE_WITH_..._BACKEND_URL`.
3. Storage: local-disk storage (the default) is **ephemeral in a container** — anything written
   between deploys/restarts is lost. Set `STORAGE_PROVIDER=s3` plus the `S3_*` vars (works with AWS
   S3 or Cloudflare R2) before real users start uploading receipts.
4. Redis/BullMQ (email-sync polling) is optional at boot — add `REDIS_URL` only once you've set up
   Gmail/Outlook OAuth credentials too, since the sync job has nothing to do without them.
5. See [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) for the full list of third-party credentials this
   unlocks, and [PLAY_STORE_LISTING.md](PLAY_STORE_LISTING.md) for the Play Console submission
   content once the backend is live.
