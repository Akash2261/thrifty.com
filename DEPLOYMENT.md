# Deploying Thrifty (backend + web app)

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

## Option E — Vercel

Vercel doesn't run this Dockerfile at all — it's a genuinely different deployment shape (serverless
functions, not a persistent container), so a few things behave differently here than in Options
A–D:

- **What runs and what doesn't.** [`api/handler.ts`](apps/server/api/handler.ts) is the
  Vercel-specific entrypoint, using the classic `/api` directory convention (a real file, not
  Vercel's auto-detected "captured Node server" convention — that one misfired in this monorepo,
  identifying a plain helper module as an invalid entrypoint; explicit beats implicit here). A
  catch-all rewrite in [`vercel.json`](apps/server/vercel.json) sends every path to it while
  preserving the original URL, so Fastify's own router still sees `/auth/signup` etc. as normal.
  It builds and starts the same Fastify app as every other host, **except** it does not start
  `node-cron` or the BullMQ email-sync worker — neither survives in a model where nothing keeps one
  process running between requests. Instead:
  - The three scheduled jobs (deadline scan, subscription digest, consent-expiry check) run as real
    **Vercel Cron Jobs** hitting `/cron/deadline-scan`, `/cron/subscription-digest`, and
    `/cron/consent-expiry` on the same schedule `src/index.ts` uses elsewhere — see
    [`apps/server/vercel.json`](apps/server/vercel.json). These routes require a `CRON_SECRET` env
    var (set it in the Vercel project's Environment Variables — Vercel then automatically sends it
    back as the `Authorization: Bearer <secret>` header on every cron invocation; generate one with
    `openssl rand -hex 24`). **Note:** the Hobby plan only allows cron jobs that run once a day —
    all three schedules here already satisfy that, but don't tighten them further without a Pro
    plan.
  - Email-sync background polling (BullMQ) simply **does not run** on Vercel — there's no
    persistent worker to run it in. Leave `REDIS_URL` unset there; don't half-configure it expecting
    it to work.
- **Storage is mandatory, not optional.** Vercel Functions have an ephemeral filesystem between
  invocations — local-disk receipt storage isn't just "gets wiped on redeploy" like a container,
  it's typically gone by the very next request. `STORAGE_PROVIDER=s3` (plus the `S3_*` vars) is
  **required** here, not a nice-to-have. `api/handler.ts` logs a startup warning if it detects
  you're on Vercel without it, but won't block boot.
- **Monorepo build.** Vercel runs `apps/server`'s own `npm run build` script directly rather than
  honoring a custom `buildCommand` in `vercel.json` (confirmed against a real failed deployment —
  it ran plain `tsc` before `packages/shared` existed or `prisma generate` had run, producing a wall
  of "cannot find module '@thrifty/shared'" / "no exported member" errors). Fixed by making
  `apps/server/package.json`'s `build` script self-sufficient: it `cd`s to the repo root, builds
  `packages/shared`, runs `prisma generate`, then compiles — correct regardless of how Vercel
  happens to invoke it. `apps/server/vercel.json` still sets `installCommand` (that part *was*
  being honored) but no longer overrides the build. This assumes the Vercel project's **Root
  Directory** is set to `apps/server` (Project Settings → Build and Deployment → Root Directory) —
  the failed build's logs showed commands running from `/vercel/path0/apps/server`, consistent with
  that setting; double check it's actually configured that way.
- **Function duration limits.** Receipt extraction calls Claude's vision API, which can take a
  few seconds — the Hobby plan's default function timeout is short. If extraction requests start
  timing out, raise `maxDuration` for that route (see Vercel's Functions docs) or move to Pro.
- Add all the other env vars from `.env.example` the same way as any other host, via the Vercel
  project's Environment Variables settings — nothing else about the "inert until configured"
  pattern changes here.

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

---

# The web app lives in a separate repo

An earlier version of this doc described deploying `apps/mobile`'s web build (Expo Router +
react-native-web) as a second Vercel project pointed at *this* repo, with Root Directory set to
`apps/mobile`. That approach kept hitting monorepo-specific Vercel issues (Root Directory ambiguity,
`npm run build` not honoring a custom `buildCommand`, needing `cd ../..` tricks for the
`packages/shared` workspace dependency) on top of the ones the backend already had to work through.

It's since been split into its own standalone repo — `~/thrifty-web`, a self-contained copy of the
same app (same screens, same auth, same API client) plus an inlined copy of `packages/shared`, with
no monorepo indirection at all: the repo root **is** the app, so there's no Root Directory setting
to get wrong and no `cd` tricks needed. See that repo's own `vercel.json` and commit history for the
full setup; the one thing to remember is it needs `EXPO_PUBLIC_API_BASE_URL` set to
`https://thrifty-com-server.vercel.app` in *its own* Vercel project's environment variables (a third,
independent place this needs to be set, distinct from both this backend's config and
`apps/mobile/eas.json`).

`apps/mobile` here in the main repo goes back to being purely the source for native (EAS) builds —
no `vercel.json`, no web-specific `build` script.
