# Thrifty — Play Store Launch Checklist

Ordered by what unblocks the most. Items marked **DONE** were completed in this session;
everything else needs either your accounts/credentials or a business decision.

## Phase 0 — Backend deployment (blocks everything below)
- [ ] Deploy `apps/server` to a real host (Fly.io, Railway, Render, a VPS, etc.) with a
      real domain and HTTPS. Right now the app only knows how to reach
      `http://localhost:4000` (or `10.0.2.2:4000` on the Android emulator) — no build can
      reach a real backend until this exists.
- [ ] Deploy Postgres + Redis for that environment (docker-compose.yml has the shapes;
      use a managed instance in production rather than the dev containers).
- [x] **DONE** — API base URL is now overridable per EAS build profile via
      `EXPO_PUBLIC_API_BASE_URL` (see `apps/mobile/eas.json` and
      `apps/mobile/src/api/client.ts`). Once you have real staging/production URLs, drop
      them into `eas.json`'s `preview`/`production` `env` blocks, replacing the
      `REPLACE_WITH_..._BACKEND_URL` placeholders.

## Phase 1 — Real third-party credentials
Everything below is coded and "inert until configured" — each integration cleanly
no-ops or 503s without its credentials, per this session's established pattern. None of
these need code changes, only accounts + env vars on the deployed server.

- [ ] **Anthropic** — API key for receipt/email extraction (`ANTHROPIC_API_KEY`).
- [ ] **Stripe** — for international Premium billing (`STRIPE_SECRET_KEY`,
      `STRIPE_WEBHOOK_SECRET`).
- [ ] **Razorpay** — for India billing (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
      webhook secret).
- [ ] **Plaid** — US bank linking (`PLAID_CLIENT_ID`, `PLAID_SECRET`, production access
      requires Plaid's production approval, not just a dev key).
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
      profiles.
- [ ] Create a **Google Play Console** developer account ($25 one-time fee).
- [ ] Generate/configure the app signing key (Play App Signing is recommended — EAS can
      generate and manage this for you via `eas build`).
- [ ] Run a real production build once Phase 0/1 URLs and credentials exist:
      `eas build --platform android --profile production`.

## Phase 3 — Play Console store listing & compliance
- [ ] Store listing assets: app icon (already have real assets in `apps/mobile/assets/`),
      feature graphic, phone/tablet screenshots, short + full description.
- [ ] **Privacy Policy URL** — draft is at [PRIVACY_POLICY.md](PRIVACY_POLICY.md) in this
      repo. **Needs real legal review** (India DPDP Act, financial-data handling) before
      publishing; then host it somewhere with a stable URL for the Play Console field.
- [ ] **Data Safety form** — can be filled out directly from what
      [PRIVACY_POLICY.md](PRIVACY_POLICY.md) already documents (data types collected:
      account info, financial info via bank-linking, photos, messages/email content
      scanned, device identifiers for push).
- [ ] **Financial Services declaration** — Thrifty links bank accounts (Plaid/AA) and
      processes payments (Stripe/Razorpay), which very likely puts it in Play's
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
In priority order: **(1)** a deployed backend with a real URL, **(2)** a Play Console
developer account, **(3)** legal review of [PRIVACY_POLICY.md](PRIVACY_POLICY.md).
Everything else in Phase 1 (the third-party credentials) can be obtained in parallel and
added to the deployed backend's env vars without further code changes.
