# Thrifty — Play Console listing content (draft)

> **STATUS: DRAFT.** Written from the app's actual, working features only — nothing here describes
> a planned/placeholder feature (e.g. the extended-warranty marketplace card is explicitly left out
> since it's an inert "coming soon" placeholder, not a real feature). Same caveat as
> [PRIVACY_POLICY.md](PRIVACY_POLICY.md): the Data Safety section below is a starting draft, not a
> substitute for you actually reviewing what's collected and answering the real Play Console form
> yourself — Google holds you responsible for its accuracy, not this document.

## Store listing text

**App name** (max 30 characters — pick one):
- `Thrifty: Warranty Tracker` (25 chars)
- `Thrifty` (7 chars — plain brand name, works as the app grows beyond warranties)

**Short description** (max 80 characters):
```
Track warranties, catch forgotten subscriptions, and stop wasting money.
```
(73 characters)

**Full description** (max 4000 characters):
```
Thrifty helps you stop losing money to two things everyone forgets: return
windows that quietly close, and subscriptions you're still paying for but
don't use.

TRACK EVERY RECEIPT, AUTOMATICALLY
Snap a photo, forward the order-confirmation email, or send it on WhatsApp —
Thrifty reads the retailer, price, and purchase date, then works out your
return window and warranty expiry. You'll get a reminder before either one
closes, not after.

Connect Gmail or Outlook and Thrifty scans just your order-confirmation and
subscription-billing emails going forward — never your full inbox, never
personal messages.

FIND SUBSCRIPTIONS YOU FORGOT ABOUT
Securely link a bank account (read-only, via India's RBI-regulated Account
Aggregator framework — Thrifty never sees your banking password) and Thrifty
finds recurring charges automatically: streaming, apps, memberships, gym
plans. See your total monthly subscription spend in one place, confirm
what you still use, and get a direct link to cancel the rest.

SHARE WITH YOUR HOUSEHOLD
Invite the people you share subscriptions and big purchases with. Everyone
sees the same warranty items and subscriptions, so nothing falls through
the cracks between family members.

FILE WARRANTY CLAIMS WITHOUT DIGGING THROUGH EMAIL
When something breaks, file a claim straight from the item's page instead
of hunting for the original receipt and warranty terms.

KNOW EXACTLY WHAT THRIFTY READS
A dedicated screen shows, in plain language, exactly what Thrifty reads from
each connection you've made — and only lists the ones you've actually
turned on.

Free for up to 5 tracked items. Upgrade to Premium for unlimited items, or
stay free and only pay a small share of what you actually save when you
cancel something with our help.

Thrifty is built for India: Account Aggregator bank-linking, Razorpay
billing, and support for Flipkart, Myntra, Croma, Reliance Digital, Amazon.in,
and more.
```
(≈1,750 characters — well under the 4,000 limit; trim further only if you want a shorter listing)

**Category:** Finance (bank-linking + payments both point here over Productivity/Shopping)

**Contact details:** [FILL IN — support email, and a website/privacy-policy URL once
[PRIVACY_POLICY.md](PRIVACY_POLICY.md) is legally reviewed and hosted]

**Content rating:** Run Play Console's IARC questionnaire — expect to answer "yes" to handling
financial information (bank-linking, payments) and user-generated content isn't applicable
(no public posting/sharing between strangers — household sharing is invite-only among people who
already know each other).

## Data Safety form (draft answers)

Fill this out for real in Play Console using [PRIVACY_POLICY.md](PRIVACY_POLICY.md) as the source
of truth — this table is a starting point so you're not staring at a blank form, not something to
copy in without checking it still matches the app.

| Data type | Collected? | Shared with third parties? | Purpose |
|---|---|---|---|
| Email address | Yes | No (only with Postmark/Razorpay/Twilio as processors, not sold) | Account creation, sign-in |
| Phone number | Yes (if phone sign-in used) | No (Twilio as SMS processor only) | Account creation, sign-in |
| Name | Optional (from Google/Apple sign-in) | No | Account creation |
| Photos | Yes (receipt photos) | No (Anthropic as extraction processor only) | App functionality — receipt/warranty tracking |
| Financial info (purchase history) | Yes (receipt price/retailer) | No | App functionality |
| Financial info (other — bank transactions) | Yes, optional (only if you link a bank account) | No (Setu/AA as processor only, read-only) | App functionality — subscription detection |
| Messages (email content) | Yes, optional (only if you connect Gmail/Outlook; scoped to order/billing emails) | No | App functionality |
| Messages (WhatsApp) | Yes, optional (only messages sent to Thrifty's own number) | No (Meta as platform processor) | App functionality |
| App activity | Yes (analytics events) | No (PostHog as processor only) | Analytics |
| Device/other IDs | Yes (push notification token) | No | Push notifications |
| Crash logs | Yes | No (Sentry as processor only) | App diagnostics |

**Is all data encrypted in transit?** Yes (HTTPS required in production).
**Do you provide a way to request data deletion?** Yes — in-app account deletion (Settings →
Delete account) plus data export (Settings → Privacy → export). See the note in
[LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) about uploaded images not yet being purged from
storage on deletion — resolve that gap before answering "yes" here with full confidence.

## Financial Services declaration

Play's Financial Services policy almost certainly applies here (bank-linking + payment
processing). Before submitting, read the current policy at Play Console's policy center and
confirm whether Thrifty needs the additional financial-services declaration form — this can add
review time, so don't leave it to the last minute.

## Assets checklist

- [x] **App icon** — `apps/mobile/assets/icon.png` (also used for `store-assets/play-store-icon-512.png`,
      a pre-sized 512×512 hi-res icon for the Play Console listing upload). Note: `icon.png`,
      `android-icon-background.png`, and `splash-icon.png` were found broken (a design-tool guide
      overlay baked into the pixels) and were rebuilt this pass — see
      [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) Phase 2.
- [x] **Feature graphic** (1024×500) — generated at `store-assets/feature-graphic.png`, matches the
      app's monochrome theme. Regenerate/redesign it any time — it's a plain code-generated
      placeholder, not a professionally designed asset.
- [ ] **Phone screenshots** (min 2, recommend 4–8) — not producible in this sandbox (no live
      backend to sign in against). The unauthenticated screens (sign-in/sign-up/phone-sign-in) do
      render correctly in a browser at phone dimensions — confirmed via
      `npm run web --workspace=@thrifty/mobile`, resizing the viewport to ~412×915. The screens
      that actually sell the app (Home dashboard, Warranty list, SubStop) need a signed-in session,
      so wait until the backend is deployed, then either reuse that same web-preview approach or
      pull screenshots from a real device/emulator via `eas build --profile development`.
- [ ] Optional: tablet/7-inch/10-inch screenshots if you want tablet listing support
