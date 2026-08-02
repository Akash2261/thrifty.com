# Thrifty — Play Store Launch Checklist

Ordered by what unblocks the most. Items marked **DONE** were completed in this session;
everything else needs either your accounts/credentials or a business decision.

## Phase 0 — Backend deployment (blocks everything below)
- [x] **DONE — deployed and verified live on Vercel.**
      `https://thrifty-com-server.vercel.app/health` returns `{"status":"ok"}`.
      [`apps/server/api/handler.ts`](apps/server/api/handler.ts) is the Vercel entrypoint
      (classic `/api` directory convention — Vercel's auto-detected "captured Node server"
      convention was tried first but misfired in this monorepo, so this is the explicit,
      unambiguous version instead), reached via a catch-all rewrite in
      [`apps/server/vercel.json`](apps/server/vercel.json). It skips `node-cron`/BullMQ,
      which don't survive serverless; the three scheduled jobs instead exist as HTTP
      routes (`/cron/deadline-scan`, `/cron/subscription-digest`, `/cron/consent-expiry`)
      gated by a `CRON_SECRET` env var, wired up as real Vercel Cron Jobs in the same
      `vercel.json`. Postgres is provisioned (Neon, via Vercel's Storage tab) and
      `DATABASE_URL`/`JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`/`ENCRYPTION_KEY` are all set.
      **Still confirm `STORAGE_PROVIDER=s3` is set** (mandatory on Vercel — its filesystem
      doesn't persist between requests at all; not yet confirmed as of this checklist
      update). This took several real deploy-and-fix iterations (build ordering, env var
      validation crashing silently, an entrypoint-detection issue, a Fastify/TypeScript
      typing quirk) — each fixed from actual Vercel logs, not guessed. If you hit another
      error later (e.g. after adding more integrations), paste the Runtime Log text and
      it'll get fixed the same way.
- [x] **DONE** — the Dockerfile path (Fly.io/Railway/Render/VPS, see
      [DEPLOYMENT.md](DEPLOYMENT.md) Options A–D) remains available as an alternative if
      you ever want off Vercel, but is unused/untested now that Vercel is the live deployment.
- [x] **DONE** — API base URL is now overridable per EAS build profile via
      `EXPO_PUBLIC_API_BASE_URL` (see `apps/mobile/eas.json` and
      `apps/mobile/src/api/client.ts`), and both `preview` and `production` profiles now
      point at `https://thrifty-com-server.vercel.app` (the stable project domain, not a
      one-off per-deployment URL — those change on every deploy).

## Phase 1 — Real third-party credentials
Everything below is coded and "inert until configured" — each integration cleanly
no-ops or 503s without its credentials, per this session's established pattern. None of
these need code changes, only accounts + env vars on the deployed server.

- [ ] **Anthropic** — API key for receipt/email extraction (`ANTHROPIC_API_KEY`).
- [ ] **Razorpay** — for billing (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
      webhook secret).
- [ ] **Setu (Account Aggregator)** — India bank/UPI data; requires a signed FIU partner
      agreement before you get real credentials, not just a signup form.
- [ ] **Google OAuth** — two separate uses, both need a verified OAuth consent screen:
      (a) "Sign in with Google", (b) Gmail read-scope for email scanning. The Gmail scope
      requires a **CASA (Cloud Application Security Assessment)** before Google allows
      more than 100 test users — budget real calendar time for this.
- [ ] **Apple Sign In** — Apple Developer account + Sign In with Apple capability.
- [ ] **Microsoft (Azure AD)** — app registration for Outlook/Hotmail OAuth.
- [ ] **Twilio** — SMS for phone-OTP sign-in (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
      sender number).
- [ ] **WhatsApp Business Platform (Meta)** — requires a verified WhatsApp Business
      Account (WABA) and a registered number before receipt-via-WhatsApp works for real
      users.
- [ ] **Postmark** — transactional email (forwarding-address receipts, cancellation
      request emails) (`POSTMARK_SERVER_TOKEN`).
- [ ] **Sentry** — crash reporting DSN (server + mobile).
- [ ] **PostHog** — analytics API key (server + mobile).
- [ ] **AWS S3 / Cloudflare R2** — production receipt-image storage (`STORAGE_PROVIDER=s3`
      + bucket credentials); local disk storage is dev-only.

## Phase 2 — Android build configuration
- [x] **DONE** — `android.package` and `ios.bundleIdentifier` set to the final
      `com.one10.thrifty` in `app.json`. Remember this is **immutable after your first
      Play Store publish** — double-check it's correct before that first production
      submit.
- [x] **DONE** — `eas.json` created with `development`/`preview`/`production` build
      profiles, plus a `submit.production.android` block wired for `eas submit`
      (references `./google-play-service-account.json`, gitignored, doesn't exist yet).
- [x] **DONE — bug fix:** `icon.png`, `android-icon-background.png`, and
      `splash-icon.png` in `apps/mobile/assets/` were **broken** — they contained a
      design-tool's guide overlay (safe-zone circles, crosshairs, grid lines) baked
      directly into the image, not real icon art. `android-icon-background.png` in
      particular is live-referenced from `app.json` as the adaptive icon's background
      layer, so every real Android install would have shown those guide artifacts behind
      the app icon. Rebuilt all three from the actual clean logo mark
      (`android-icon-foreground.png`, which was fine) — verify them yourself (they're
      real image files, not something you can typecheck) before shipping.
- [ ] Create a **Google Play Console** developer account ($25 one-time fee).
- [ ] Create a **Google Play Android Developer API** service account (Play Console →
      Setup → API access → Create new service account → follow the Google Cloud link →
      grant it access back in Play Console with at least "Release" permissions), download
      its JSON key, save it as `apps/mobile/google-play-service-account.json` (already
      gitignored). Without this, `eas submit` has nothing to authenticate with.
- [ ] Generate/configure the app signing key (Play App Signing is recommended — EAS can
      generate and manage this for you via `eas build`).
- [ ] **Android push notifications (FCM V1)** — not yet configured, and needed before
      push notifications work in a real production build (they're currently only
      registered client-side; nothing in this repo sets up Android's messaging
      credentials). You need: (1) a Firebase project linked to this same
      `com.one10.thrifty` package, (2) its `google-services.json` downloaded and placed at
      `apps/mobile/google-services.json`, referenced via `android.googleServicesFile` in
      `app.json` (not added yet — don't add that config line until the real file exists,
      or EAS builds will fail looking for a missing file), and (3) a separate Firebase
      service-account JSON (different from the Play Store one above) uploaded to EAS
      under Android credentials → Google Service Account → FCM V1. `google-services.json`
      itself is safe to commit (public identifiers only); the FCM service-account key is
      not — never commit that one.
- [ ] Run a real production build once Phase 0/1 URLs and credentials exist:
      `eas build --platform android --profile production`.

## Phase 3 — Play Console store listing & compliance
- [x] **DONE** — App title, short/full description, category, and a draft Data Safety
      answer table are in [PLAY_STORE_LISTING.md](PLAY_STORE_LISTING.md), ready to paste
      into the Play Console forms (review before submitting — it's a draft, not verified
      against the live form's exact wording).
- [x] **DONE** — Feature graphic (1024×500) and a 512×512 hi-res icon are generated at
      `store-assets/feature-graphic.png` and `store-assets/play-store-icon-512.png`.
- [ ] Phone screenshots still needed (min 2, Play requires them) — **not producible in
      this sandbox** since there's no live backend to sign in against. Verified the web
      preview renders correctly though (`npm run web --workspace=@thrifty/mobile`, resize
      the browser to ~412×915, screenshot sign-in/sign-up/phone-sign-in). Once the backend
      is deployed and you can actually sign in, either reuse that same web-preview
      approach for the authenticated screens (Home, Warranty, SubStop, Settings) or pull
      them straight from a real device/emulator via `eas build --profile development`.
- [ ] **Privacy Policy URL** — draft is at [PRIVACY_POLICY.md](PRIVACY_POLICY.md) in this
      repo. **Needs real legal review** (India DPDP Act, financial-data handling) before
      publishing; then host it somewhere with a stable URL for the Play Console field.
- [ ] **Data Safety form** — draft answers in [PLAY_STORE_LISTING.md](PLAY_STORE_LISTING.md);
      still needs you to actually fill out the real Play Console form and keep it in sync
      if data practices change.
- [ ] **Financial Services declaration** — Thrifty links bank accounts (Account
      Aggregator) and processes payments (Razorpay), which very likely puts it in Play's
      "Financial Services" and "Sensitive Data" app categories, triggering extra
      declarations/review. Read Play's current Financial Services policy before
      submitting; this may add review time.
- [ ] Target API level / Android compliance — EAS/Expo keeps this current automatically
      for recent SDK versions; just confirm the Expo SDK in use still meets Play's
      current minimum target API level at build time.

## Phase 4 — Account-deletion & data-handling compliance
- [x] **DONE** — In-app account deletion, required by Play's User Data policy for any
      app supporting account creation. Implemented end-to-end this session:
      - Backend: `deleteAccount()` in
        [apps/server/src/modules/auth/auth.service.ts](apps/server/src/modules/auth/auth.service.ts) —
        cascade-deletes all user-owned data (receipts, subscriptions, bank/email/WhatsApp
        connections, claims, notifications, etc. — every relevant `schema.prisma`
        relation is `onDelete: Cascade`), and correctly dissolves a household if the
        deleting user is its owner (mirrors `household.service.ts`'s existing
        `leaveHousehold` behavior).
      - Route: `DELETE /auth/account` in
        [apps/server/src/modules/auth/auth.routes.ts](apps/server/src/modules/auth/auth.routes.ts).
      - Mobile: `deleteAccount()` in
        [apps/mobile/src/ctx/auth.tsx](apps/mobile/src/ctx/auth.tsx) and a
        confirm-gated, destructively-styled button in
        [apps/mobile/app/(app)/settings.tsx](apps/mobile/app/(app)/settings.tsx).
      - **Verified live** against the local dev DB: created two users, formed a
        household, deleted the owner's account, confirmed the account was fully gone
        (404 on `/auth/me`), the household was dissolved for the remaining member
        (`household: null`), and the remaining member's own account was unaffected.
- [ ] **Known gap — not done:** uploaded receipt images in local disk/S3/R2 storage are
      **not** deleted when an account is deleted (`StorageProvider` has no `delete()`
      method yet). Add one and call it from `deleteAccount()` before relying on the
      privacy policy's deletion language being fully accurate.
- [ ] Consider whether Play's User Data policy expects a **web-based** account-deletion
      request path too (in addition to in-app), referenced from the Data Safety section —
      common for apps with sensitive categories.

## Phase 5 — Real-device testing
- [ ] Everything this session has only been verified via browser-preview and curl/script
      testing — **no real Android/iOS device or emulator run has happened.**
- [ ] Build a dev client (`eas build --profile development`) and install it on a real
      device or emulator; walk the full golden path (sign up, capture a receipt, connect
      email, link a bank/AA account, detect + cancel a subscription, delete account).
- [ ] Test push notifications on a real device (simulators/emulators have limited or no
      push support depending on platform).

## Phase 6 — Submit for review
- [ ] Internal testing track first (Play Console supports this without full review).
- [ ] Move to production only after Phase 3's Financial Services / Data Safety
      declarations are in and Phase 5's device testing has passed.

---

## What's genuinely blocking you right now
The backend is deployed and live, so this list is shorter now. In priority order:
**(1)** confirm `STORAGE_PROVIDER=s3` (plus real `S3_*` credentials) is set in Vercel —
receipt uploads are silently broken without it, **(2)** a Play Console developer account +
its API service account key, **(3)** a Firebase project + `google-services.json` for
Android push, **(4)** legal review of [PRIVACY_POLICY.md](PRIVACY_POLICY.md), **(5)** an
`eas login` + real production build (needs your Expo account — not something this session
can do for you). Everything else in Phase 1 (the third-party credentials — Anthropic,
Razorpay, Setu, Google/Microsoft OAuth, Twilio, WhatsApp, Postmark, Sentry, PostHog) can be
added to Vercel's env vars in parallel, no further code changes needed.
