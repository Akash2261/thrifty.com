# Thrifty

One app, two money-saving modules:

- **Warranty Wallet** — photograph or forward receipts, auto-track return-window and warranty
  deadlines, get notified before they close.
- **SubStop** — read-only bank/card scan that surfaces recurring subscriptions and monthly
  "leakage."

## Repo layout

```
apps/
  server/   Fastify + TypeScript API (Postgres via Prisma)
  mobile/   Expo (React Native) app, file-based routing via expo-router
packages/
  shared/   Zod schemas / TS types shared by both apps
```

## Prerequisites

- Node.js 20+ and npm
- A Postgres 16 instance (local Docker, `docker-compose.yml` is provided; or any Postgres
  connection string)
- For the mobile app: [Expo Go](https://expo.dev/go) on your phone, or an iOS/Android
  simulator

> This machine didn't have Node.js, Docker, or Homebrew installed when this project was built,
> so development so far has used a self-contained Node binary and an in-process Postgres
> (`embedded-postgres`, dev-only) instead. For your own day-to-day development, install Node.js
> normally (e.g. via [nvm](https://github.com/nvm-sh/nvm) or the official installer) and Docker
> Desktop — that will let `docker-compose up` and plain `npm`/`npx` commands work as documented
> below.

## Setup

```bash
npm install

# Start Postgres
docker-compose up -d

# Configure the server
cp apps/server/.env.example apps/server/.env
# edit apps/server/.env: set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET to random strings
# (e.g. `openssl rand -hex 32`) — DATABASE_URL already matches docker-compose's defaults.

npm run prisma:migrate
npm run build:shared
```

## Running

```bash
# Terminal 1
npm run dev:server      # http://localhost:4000

# Terminal 2
npm run dev:mobile      # opens Expo dev tools; press i/a for simulator, or scan the QR code
```

The mobile app talks to `http://localhost:4000` by default (see `apps/mobile/app.json` →
`expo.extra.apiBaseUrl`). If you're running on a physical phone over Expo Go, change that to your
computer's LAN IP so the phone can reach it.

## What's implemented so far

**Milestone 1** — Monorepo scaffold, shared TypeScript types/schemas, Postgres schema for `User`,
`WarrantyItem`, `RetailerRule`, JWT-based auth (`/auth/signup`, `/auth/login`, `/auth/refresh`,
`/auth/me`), and a mobile app shell (sign-in/sign-up, session persistence, tab-based Home /
Warranty / SubStop / Settings gated behind authentication).

**Milestone 2 (Warranty Wallet)** — Receipt capture (camera or photo library) → upload →
Claude-vision extraction (`ANTHROPIC_API_KEY` required, see below) → return-window/warranty-expiry
calculation → item list & detail/edit screens → Home dashboard shows the soonest real deadline →
daily cron (`runDeadlineScan`) pushes a reminder 3 days before a deadline via Expo push, once a
device registers a push token.

**Milestone 3 (SubStop)** — Bank/card linking via Plaid's Hosted Link (`PLAID_CLIENT_ID`/
`PLAID_SECRET` + `ENCRYPTION_KEY` required, see below), opened in an in-app browser so no native
Plaid SDK/custom dev client is needed — works in Expo Go. A daily-testable `POST /bank/sync` pulls
the last 90 days of transactions and runs a recurring-charge detector (grouped by normalized
merchant, checked for consistent cadence + amount — see
`apps/server/src/modules/subscriptions/recurringDetection.ts`, unit-tested) into `DetectedSubscription`
rows. The SubStop tab shows total monthly spend and lets you confirm/flag each subscription as
still-in-use. **India bank-linking is not implemented** — it needs a signed Account Aggregator
partner agreement (e.g. with Setu) and their specific API contract, which isn't publicly
documented; see `accountAggregatorProvider.ts` for the honest stub.

**Milestone 4 (cancellation requests)** — Tapping a subscription offers "How do I cancel this?",
which resolves one of three ways via a curated `KnownService` directory
(`prisma/seed.ts`, matched against the normalized merchant name):
- **Self-service (default, 14 seeded services)** — deep-links straight to the provider's real
  account/cancellation page (Netflix, Spotify, Disney+, Amazon Prime, etc.) in an in-app browser.
  Zero risk: it's just a URL.
- **Email** — for services with a *verified* cancellation contact, drafts an email and shows the
  user the exact To/Subject/Body before sending; nothing goes out until they explicitly tap Send.
  The seed data ships with **zero** email entries on purpose — I couldn't verify real cancellation
  contacts for arbitrary companies without risking a wrong/fabricated address, so the directory
  only auto-populates the safe self-service method. Add verified `email` rows to `KnownService`
  yourself once you've confirmed a company's real process (see the comment in `prisma/seed.ts`).
- **Unknown** — generic guidance when no directory entry matches.

**Milestone 5 (billing)** — A `PaymentProvider` abstraction (Stripe for US, Razorpay for India,
selected by `user.country`) creates a hosted checkout/subscription-payment session, opened in the
in-app browser (same pattern as Plaid's Hosted Link). Both providers' webhooks
(`POST /billing/webhook/stripe`, `POST /billing/webhook/razorpay`) verify their real cryptographic
signature before upgrading/downgrading `user.tier` — I verified this end-to-end by constructing
correctly-signed test events myself (Stripe's `t=...,v1=HMAC-SHA256(...)` scheme and Razorpay's
HMAC-SHA256-over-body scheme) since no live Stripe/Razorpay account was available; tampered
signatures are correctly rejected with 400. The Settings screen shows an upgrade button for free
users, and hitting the 5-item Warranty Wallet limit now prompts to upgrade instead of just
erroring.

**Milestone 6 (email-forwarding receipts)** — Every user gets a personal forwarding address
(shown in Settings with a copy button: `{random-token}@INBOUND_EMAIL_DOMAIN`). Forward any
order-confirmation email to it and `POST /inbound-email/webhook/:secret` (a Postmark inbound-parse
target) resolves the token straight to a user — no signature is trusted from the email itself —
then extracts either from an image attachment (reuses the same Claude vision path as photo
capture) or, if there's no image, from the email's text body via a second Claude tool-use call
(`extractReceiptFromEmailText`). The webhook always responds 200 (per Postmark's guidance, to
avoid retry storms) even when processing fails internally; I verified the whole pipeline —
wrong-secret rejection, unknown-token no-op, text-only extraction, and image-attachment
extraction — by sending hand-built Postmark-shaped payloads and confirming each one traced
correctly through the logs down to the same "missing ANTHROPIC_API_KEY" boundary as the photo path.

This completes all six milestones from the original build plan.

---

## Roadmap expansion (India-first, 5 new milestones)

The user supplied a detailed India-first product roadmap (Phase 0–6) to extend the app above with
household sharing, email/WhatsApp receipt ingestion, India bank-data (Account Aggregator), and a
claims/marketplace layer. That roadmap was mapped into 5 milestones on top of the original six.

**Roadmap Milestone 1 (Foundation hardening)** — done:
- **Household schema** — `Household`/`HouseholdMember` tables and a nullable `householdId` on
  `User`, laid down now so later milestones' foreign keys don't need a disruptive migration.
  Sharing UI itself is still to come (roadmap Milestone 5).
- **Notification log** — a persisted `Notification` table (type/scheduledFor/sentAt/status) plus a
  `notificationPreferences` JSON blob on `User`, replacing the old boolean-flags-only approach.
  `runDeadlineScan` now writes through this model and respects per-user preferences; Settings has
  a preferences screen; the mobile app has a notifications API client.
- **Phone-OTP auth** — `SmsProvider` interface (Twilio implementation), `POST /auth/otp/send` /
  `POST /auth/otp/verify`, a two-step phone sign-in screen. Returns a clean 503 without
  `TWILIO_*` env vars.
- **Google / Apple sign-in** — `POST /auth/google` / `POST /auth/apple` verify the ID token from
  native Google/Apple sign-in (pure JWT verification server-side, no OAuth dance or app-review
  needed). All four auth methods (email/password, phone-OTP, Google, Apple) coexist on one `User`
  model with nullable `email`/`phoneNumber`/`passwordHash` and an `authProvider` enum.
- **Storage abstraction** — `StorageProvider` interface with `LocalDiskStorage` (dev default) and
  `S3Storage` (`@aws-sdk/client-s3`, works for AWS S3 or any S3-compatible host like Cloudflare
  R2), selected via `STORAGE_PROVIDER`.
- **Redis + BullMQ** — added to `docker-compose.yml` plus a `createQueue`/`createWorker` helper
  module; first real consumer will be roadmap Milestone 2's email-polling job.
- **Sentry + PostHog** — crash reporting and product analytics on both server and mobile, inert
  until `SENTRY_DSN` / `POSTHOG_API_KEY` are set.
- **Dashboard polish** — the Home tab is now a unified list with All/Warranties/Returns/
  Subscriptions filter chips and a total-value-at-stake widget (active warranty item prices +
  monthly subscription spend).

Two real bugs were found and fixed during verification: (1) OTP codes were persisted before the
SMS send attempt, so a failed send still burned the 60-second resend cooldown — fixed by sending
first, persisting only on success; (2) the Google sign-in button crashed the entire sign-in screen
on mount when no Google client ID was configured (`useIdTokenAuthRequest`'s internal invariant
throws synchronously) — fixed with a placeholder client ID plus a computed `isGoogleConfigured`
flag that hides the button instead of crashing.

**Roadmap Milestone 2 (Email integration)** — done:
- **EmailConnection model** — encrypted OAuth tokens, sync status/error, historical-scan-depth,
  an incremental-sync cursor (Gmail historyId / Graph deltaLink), plus `PendingEmailOAuth`
  (mirrors `PendingBankLink`'s role: ties the provider's OAuth redirect back to the user who
  started it) and `ScannedEmailMessage` (idempotency + dedup + review-queue storage, one row per
  message ever looked at).
- **Gmail** — real OAuth2 code flow + Gmail REST API (history-based incremental sync, falling
  back to a date-bounded `messages.list` on the first sync). **Outlook/Hotmail** — real Microsoft
  identity platform OAuth2 + Graph API delta query. Both implemented via plain `fetch` calls, no
  heavy SDK. **Yahoo** — OAuth2 identity works (verifies which address the user owns), but Yahoo
  doesn't offer a public Mail-read API to new developers anymore (discontinued years ago) — this
  is an honest stub, not a fake feed; see `apps/server/src/modules/email/yahooProvider.ts`.
- **Retailer template-parser layer** — regex-based parsers for Amazon, Flipkart, Myntra, Croma,
  Reliance Digital, and Apple order-confirmation emails (order number, item name, price), unit
  tested. Falls back to the existing Claude-based `extractReceiptFromEmailText` for unrecognized
  senders — but that path is lower-trust, so it lands in a **review-before-save queue** instead
  of auto-saving.
- **Duplicate detection** — a shipping-notification email for an order already saved (matched by
  the retailer's own order number, or by retailer+item+date when no order number is available)
  is marked `duplicate` rather than creating a second warranty item.
- **Subscription-cadence detection** — known subscription senders (Netflix, Spotify, Hotstar,
  YouTube Premium) or generic renewal language ("renews monthly", "next billing date") in any
  email upserts a `DetectedSubscription` row, now tracked with `detectedFromBank`/
  `detectedFromEmail` provenance flags.
- **BullMQ email-sync job** — polls every active connection every 4 hours (inert without
  `REDIS_URL`, same as the Milestone-1 queue infra).
- **Mobile** — a "Manage email connections" screen in Settings (provider picker, scan-depth
  selector, connect via `expo-web-browser`'s `openAuthSessionAsync` against the backend's OAuth
  authorize/callback routes, sync/disconnect actions), and a review-before-save screen with
  editable fields before approving or dismissing each low-trust extraction.

Two real bugs were found and fixed during verification: (1) a regex bug in the price parser —
`₹|Rs\.?` wasn't wrapped in a non-capturing group, so the `|` alternation's low precedence caused
the whole match to short-circuit on the currency symbol alone with the price capture group never
engaging; (2) the mobile "Sync" button only reloaded connection state on success, so a failed sync
left the card showing stale "Connected" text even though the server had already recorded the
error — fixed by reloading in both branches.

I verified the full pipeline (subscription detection, retailer auto-save, duplicate detection,
idempotent re-processing, Claude-fallback-unavailable graceful degradation, and review-queue
approve/reject) by calling the real service functions directly against the dev database with
fabricated provider messages, then confirmed the connect/sync/disconnect/review UI end-to-end in
a browser walkthrough — including a save that showed up correctly on the Home dashboard.

**Roadmap Milestone 3 (WhatsApp integration)** — done:
- **Linking flow** — `POST /whatsapp/link` generates a 6-digit code (10-minute expiry) shown in
  the app; the user texts it to Thrifty's WhatsApp Business number, and the inbound webhook
  matches it to create a `WhatsAppConnection` tying that phone number to their account — the same
  "prove ownership over an out-of-band channel" idea as phone-OTP, just via WhatsApp instead of
  SMS. The mobile screen polls status every 3s while a code is showing and flips to "Connected"
  automatically once linked, no manual refresh needed.
- **Real Meta WhatsApp Cloud API integration** — OAuth-free (Cloud API auth is just a bearer
  token), implemented via plain `fetch`: `sendTextMessage` for replies, `fetchMediaBytes` for
  downloading inbound receipt photos (Meta's media endpoints return a short-lived signed URL that
  itself needs the same bearer token). Inert (clean 503) without `WHATSAPP_ACCESS_TOKEN`/
  `WHATSAPP_PHONE_NUMBER_ID` — pursue Meta's WABA verification separately.
- **Webhook receiver** (`/webhooks/whatsapp`) — handles Meta's one-time `GET` verification
  handshake (echoes `hub.challenge` back only if `hub.verify_token` matches), and verifies every
  inbound `POST`'s `X-Hub-Signature-256` (HMAC-SHA256 over the raw body with the app secret,
  timing-safe compared) before processing — always replies `200` regardless, since Meta retries
  aggressively on non-2xx and a bad signature is never going to become valid on retry.
- **Receipt processing** reuses the exact same Claude vision/text extraction and
  `createWarrantyItemFromExtractedData` path as photo capture and inbound email — a linked number
  sending a photo or forwarding order-confirmation text gets a reply like `📦 Saved "Sony
  Headphones" — return window closes 8/15/2026`. A casual, non-receipt-looking text gets a
  helpful nudge instead of burning a Claude call.
- Every reply send is best-effort — a failed/misconfigured send never fails the underlying
  link/save action or crashes webhook processing.

I verified the whole flow with hand-constructed, correctly-signed webhook payloads against the
dev server: the GET handshake (correct/incorrect verify token), POST signature rejection vs.
acceptance, the full linking round-trip (code issued via the authenticated API, "texted" via a
fake inbound message, confirmed linked via the status endpoint and reused-code protection), and
the three inbound-message branches (receipt-ish text, casual text, unlinked sender) — then
confirmed the mobile Link WhatsApp screen end-to-end in a browser walkthrough, including the
auto-polling transition from "code shown" to "Connected" the moment the backend recorded the link.

**Roadmap Milestone 4 (India Account Aggregator bank/UPI data)** — done:
- **Real RBI-mandated consent flow** replacing the honest stub from Milestone 3: `BankConsent`
  model tracks the full lifecycle (pending → active/rejected/paused/revoked → expired), a
  purpose-built consent-explainer screen (what's shared, purpose, duration, revocation note)
  precedes the redirect to the AA's own consent-approval UI, and a `Consent-Notification` webhook
  updates status as the user acts. `PollLinkSession`/`exchangePublicToken` were extended (not
  replaced) to fit this async, webhook-driven lifecycle rather than Plaid's synchronous one.
- **Real ReBIT FI-data encryption** — the AA framework's mandated end-to-end encryption (X25519
  ECDH key exchange + HKDF-SHA256 + AES-256-GCM) is a public, TSP-agnostic crypto spec, so it's
  implemented for real rather than stubbed, in `accountAggregator/aaEncryption.ts`. Unit-tested
  round-trip with synthetic keypairs (derive-same-key-both-sides, encrypt/decrypt, and
  export/reimport the private key across the async webhook boundary) — the strongest verification
  possible without a live AA sandbox.
- **Setu AA client** (`accountAggregator/setuAaClient.ts`) — consent request creation, FI-data
  session creation, and session-result fetching, built to the ReBIT-mandated JSON contract (stable
  across every AA/TSP) with Setu-specific base URL/auth headers as the best-effort placeholder
  pending their partner docs. All inert (503) without `SETU_AA_CLIENT_ID/SECRET/PRODUCT_INSTANCE_ID`.
- **Multi-source subscription provenance** — fixed a real bug where a subscription first detected
  via email never got flagged as bank-confirmed once bank sync later found the same merchant
  (the upsert's update branch silently dropped `detectedFromBank`). The SubStop list now shows a
  "via bank" / "via email" / "via bank + email" badge per subscription.
- **Monthly subscription-digest job** — finally wires up the `unusedSubscriptionDigest`
  notification preference (present since Milestone 1 but never driven by an actual job) into a
  monthly spend summary push. **Consent-expiry job** — daily sweep flipping past-due
  `BankConsent` rows to `expired`.

I verified the ECDH/HKDF/AES crypto with 4 passing round-trip unit tests, then verified the rest
against the dev database and a running server: clean 503s for India bank-linking and the AA
webhooks without credentials configured, the full consent lifecycle via hand-signed webhook
payloads (pending → active, unknown-handle no-op, data-notification acknowledgment), the
provenance-fix logic directly (confirmed it only works when merchant normalization keys actually
align — a separate, pre-existing normalization limitation, not a new bug), the digest and
consent-expiry jobs, and the mobile consent-explainer screen end-to-end in a browser walkthrough
(including confirming the real `503` surfaces correctly when tapping "Continue to consent").

**Roadmap Milestone 5 (Monetization refinements + Claims + Household + Polish)** — done, and
completes the 5-milestone roadmap expansion:
- **Revenue-share cancellation pricing** — an alternative to flat Premium: free-tier users pay
  nothing upfront, and only get charged (a 25% cut of a year's estimated savings) once they
  confirm a subscription cancellation actually worked, via `POST /subscriptions/:id/confirm-cancelled`.
  Extended `PaymentProvider` with a one-time-charge method (Stripe one-off Checkout Session,
  Razorpay Payment Link) alongside the existing flat-subscription checkout; both webhook parsers
  now recognize a `savings_charge_completed` event distinct from subscription activation.
- **Claims** — a `Claim` model unifying warranty-defect and return-assistance requests, filed
  from a warranty item's detail screen and listed on a dedicated Claims screen. Matches against a
  `ServiceCenterContact` directory that ships with **zero** rows on purpose — same honest
  reasoning as `KnownService`'s unseeded `email` method: a wrong contact for a warranty claim is
  worse than no directory entry.
- **Extended-warranty marketplace placeholder** — a clearly inert card on the warranty item detail
  screen when a warranty is closing within 30 days ("available soon"), with no fake partner link,
  per the roadmap's explicit call for a placeholder rather than a fabricated integration.
- **Household sharing** — create/invite/join/leave (`Household.inviteCode`), plus a read-only
  shared view of other members' warranty items and subscriptions. The owner leaving dissolves the
  household for everyone (no ownership-transfer flow yet — a deliberately bounded scope for this
  pass).
- **Multi-source provenance surfaced in the UI** — SubStop now shows "via bank" / "via email" /
  "via bank + email" per subscription, using the fields added (and the upsert bug fixed) in
  Milestone 4.
- **Data export + DPDP explainability** — `GET /account/export` streams a sectioned CSV (warranty
  items, subscriptions, cancellation requests); a "What we read from your data" screen lists only
  the categories actually relevant to what's connected (skips WhatsApp/email/bank sections
  entirely if nothing is linked).
- **Perf polish** — receipt photos are resized (bounded to 1600px) and re-compressed via
  `expo-image-manipulator` before upload, cutting upload size on typical 12MP+ phone camera shots
  with no meaningful loss of legibility for Claude's vision extraction.

I verified the full revenue-share billing loop end-to-end: confirmed the free-tier charge-creation
path fails cleanly (503) without Stripe/Razorpay credentials, then completed it with a
hand-signed Stripe webhook event and confirmed the `CancellationSavingsCharge` row flipped to
`charged` with the right provider payment-intent id. Verified household create/invite/join/
shared-visibility/owner-leave-dissolves-household against the dev database with two real test
users, claims filing (confirmed the honest zero-contact behavior), and the CSV export/DPDP content
(confirmed it only lists categories for connections that actually exist). Confirmed all the new
mobile screens (Household, Claims, Data & Privacy, billing explainer) in a browser walkthrough,
including the household-creation round trip rendering live invite code and member list.

This completes all 5 milestones of the India-first roadmap expansion, on top of the original six
milestones — eleven milestones built this session in total.

### Email-pipeline hardening (post-roadmap follow-up)

A follow-up pass after the roadmap closed, prompted by making sure a *linked* Gmail/Outlook
account actually delivers on both halves of the promise (subscription detection *and* warranty
extraction), not just that the OAuth handshake works:
- **Fixed a real bug**: Gmail's historical sync only ever fetched the first 50 matching messages
  with no pagination — for any inbox with more mail than that in the chosen scan-depth window,
  most of it silently never got processed. Now paginates (bounded at 300 messages per sync, with
  the remainder picked up incrementally via historyId on the next scheduled sync) and fetches
  message bodies in small parallel batches instead of one at a time.
- **Added image-attachment support** to both Gmail and Outlook sync — previously only body text
  was ever read, so a receipt sent as a scanned image/photo attachment (common for many retailers)
  was invisible to the pipeline. The Claude-fallback path now prefers an attached image over body
  text when present, and skips the receipt-ish subject-line gate in that case (an attached scan
  rarely has receipt-y subject text of its own).
- **Broadened subscription-cadence detection**: a few more single-purpose subscription senders
  (Disney+, Max, ZEE5, SonyLIV, JioSaavn, Notion, Slack, Zoom) and ISO-currency-code amount parsing
  ("USD 59.99", not just "$59.99"). Deliberately did **not** add mixed-purpose retailers (Amazon,
  Apple, Flipkart) to the sender list — they send both product orders and subscription renewals
  from the same domain, so a sender-only match would misclassify ordinary orders as subscriptions;
  a unit test now locks in that this can't happen.

Verified the pagination logic by code inspection (no live Gmail/Outlook account available to test
against), and empirically verified the image-attachment routing by temporarily instrumenting the
two extraction functions and confirming via `processMessage` calls against the dev database that
an attached image correctly triggers `extractReceiptFromImage` while a plain non-receipt-looking
email correctly skips extraction entirely — then reverted the instrumentation. All 20 vitest
cases (6 new) pass; both apps typecheck clean.

## Environment variables

See `apps/server/.env.example` for the full list. Required so far:
- **`ANTHROPIC_API_KEY`** (Milestone 2) — `POST /receipts` returns a clear 503 without it, rather
  than crashing.
- **`PLAID_CLIENT_ID` / `PLAID_SECRET` / `ENCRYPTION_KEY`** (Milestone 3, US bank-linking only) —
  `POST /bank/link-token` returns a clear 503 without them. Get free Sandbox keys at
  https://dashboard.plaid.com/; generate `ENCRYPTION_KEY` with `openssl rand -hex 32`.
- **`POSTMARK_SERVER_TOKEN` / `CANCELLATION_FROM_EMAIL`** (Milestone 4, email-cancellation only) —
  only matters once you add a verified `email`-method row to `KnownService`; self-service
  cancellation links work without them.
- **`STRIPE_SECRET_KEY` / `STRIPE_PRICE_ID` / `STRIPE_WEBHOOK_SECRET`** (Milestone 5, US billing) —
  create a recurring Price in your Stripe dashboard first.
- **`RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_PLAN_ID` / `RAZORPAY_WEBHOOK_SECRET`**
  (Milestone 5, India billing) — create a Plan in your Razorpay dashboard first.
- **`INBOUND_EMAIL_DOMAIN` / `POSTMARK_INBOUND_SIGNATURE_SECRET`** (Milestone 6, receipt
  forwarding) — set up Postmark's inbound-parse for the domain, pointed at
  `POST /inbound-email/webhook/{that secret}`.
- **`GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`** (roadmap Milestone 2, Gmail) —
  distinct from `GOOGLE_CLIENT_ID` (that one's for sign-in only). **`MICROSOFT_CLIENT_ID` /
  `MICROSOFT_CLIENT_SECRET`** (Outlook/Hotmail). **`YAHOO_CLIENT_ID` / `YAHOO_CLIENT_SECRET`**
  (Yahoo — identity only, see above). **`SERVER_PUBLIC_URL`** — the server's own HTTPS base URL,
  needed to build the OAuth redirect URIs registered with each provider.
