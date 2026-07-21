# Thrifty — Privacy Policy

> **STATUS: DRAFT — NOT LEGALLY REVIEWED.**
> This document was generated from the app's actual code and data flows so that it is
> factually accurate as of this writing. It has **not** been reviewed by a lawyer and
> must not be published to users or entered into the Play Console "Privacy Policy" field
> until it has been. In particular, get real legal review on:
> - India's **Digital Personal Data Protection Act (DPDP), 2023** obligations (consent
>   manager language, data principal rights, cross-border transfer rules, breach
>   notification timelines)
> - Financial-data handling rules tied to bank/UPI access (RBI Account Aggregator
>   framework consent language)
> - Retention periods — this draft describes current behavior, not necessarily the
>   retention periods you want to legally commit to
>
> Once reviewed and finalized, this file can be published (e.g. as a hosted Artifact) to
> get a real URL for the Play Console "Privacy Policy" field and the app's own
> settings/legal screen.

**Last updated:** [FILL IN ON PUBLISH]
**Effective date:** [FILL IN ON PUBLISH]

## 1. Who we are

Thrifty ("we", "us", "the App") helps you track warranties, return windows, and
subscriptions, and helps you cancel subscriptions you no longer use. Thrifty is offered
to users in India only. This policy describes what data the App collects, why, and how
you can control or delete it.

[COMPANY LEGAL NAME, ADDRESS, CONTACT EMAIL — FILL IN]

## 2. Data we collect

### 2.1 Account information
- Email address and password (hashed, never stored in plain text), **or**
- Phone number, verified via one-time passcode (SMS), **or**
- Google or Apple sign-in (we receive your name/email from Google/Apple; we never see
  your Google/Apple password)

### 2.2 Receipts and warranty items
- Photos of receipts you capture or upload
- Item details you enter or that our AI extracts from a receipt (retailer, price,
  purchase date, product name)
- Emails you manually forward to your personal Thrifty forwarding address
- If you connect Gmail or Outlook: we scan **only order-confirmation and
  subscription-billing emails** in your mailbox for receipt data — we do not read your
  full inbox, personal correspondence, or non-commerce email. You choose how far back we
  scan when you connect an account, and you can disconnect at any time from Settings.
- If you link WhatsApp: we only read messages you send **to Thrifty's own WhatsApp
  number** (receipt photos or forwarded order confirmations) — we have no access to any
  other WhatsApp conversation, contact list, or message.

### 2.3 Bank and card transaction data (optional, for subscription detection)
- If you link a bank account or card via India's RBI-regulated Account Aggregator
  framework, we receive **read-only transaction data** — merchant name, amount, date —
  used to detect recurring subscription charges.
- We **never** receive or store your online banking username, password, or card PIN.
  That authentication happens entirely with your bank or the Account Aggregator, not
  with us.
- You can revoke this access (revoke consent / unlink) at any time.

### 2.4 Payments
- If you upgrade to Premium or confirm a savings-based cancellation charge, payment is
  processed by Razorpay. We do not store your card number — Razorpay handles that under
  its own PCI-compliant systems.

### 2.5 Device and usage data
- A push-notification token, so we can notify you about upcoming return-window or
  warranty deadlines, or detected subscriptions.
- Basic product-analytics events (e.g. "item created", "subscription detected",
  "upgraded to Premium") via PostHog, used to understand which features are useful.
- Crash and error reports via Sentry, used to fix bugs. These may include device type,
  OS version, and the app state at the time of the crash.

### 2.6 Household sharing (optional)
- If you join or create a household, other members of that household can see the
  warranty items and subscriptions you choose to share within it. Leaving or dissolving
  a household stops this sharing.

## 3. Why we use your data
We use the data above only to operate the App's features: extracting and tracking
warranty/return/subscription information, sending you deadline reminders, detecting and
helping you cancel unused subscriptions, processing payments you initiate, and fixing
bugs. We do not sell your personal data.

## 4. Third parties we share data with
- **Anthropic (Claude)** — receipt images/text are sent to Claude's API to extract
  structured item data. Not used to train Anthropic's models under our commercial terms.
- **Setu (Account Aggregator TSP)** — bank-linking and transaction data, as described
  above.
- **Razorpay** — payment processing.
- **Twilio** — SMS delivery for phone sign-in codes.
- **Google / Microsoft** — OAuth and, if connected, email scanning as described above.
- **Meta (WhatsApp Business Platform)** — if you message our WhatsApp number.
- **Postmark** — transactional email delivery (including your forwarding-address emails
  and cancellation-request emails you explicitly ask us to send).
- **Sentry**, **PostHog** — crash reporting and product analytics as described above.
- **Cloud storage (AWS S3 / Cloudflare R2 or local server disk)** — receipt image
  storage.

We do not share your data with advertisers or data brokers.

## 5. Your controls
- **Notification preferences** — Settings → Notifications.
- **Disconnect email/WhatsApp/bank** — from their respective screens at any time.
- **Export your data** — Settings → Privacy → data export (CSV).
- **See what we read from your data** — Settings → Privacy → "What we read from your
  data".
- **Delete your account** — Settings → "Delete account". This permanently deletes your
  account and the data directly tied to it (warranty items, subscriptions, connections,
  claims, notifications). If you own a shared household, deleting your account dissolves
  it for all members. This action cannot be undone.
  [LEGAL/ENG TODO before publishing: confirm retention/deletion timeline for uploaded
  receipt images in cloud/local storage — see LAUNCH_CHECKLIST.md.]

## 6. Data retention
[FILL IN once retention periods are legally decided — e.g. "we retain your data until
you delete your account, except where we are required by law to retain records
longer."]

## 7. Children's privacy
Thrifty is not directed at children under 18 (or the age of majority in your
jurisdiction) and we do not knowingly collect data from them.

## 8. Changes to this policy
[FILL IN — standard "we may update this policy and will notify you" language.]

## 9. Contact us
[FILL IN — support email / grievance officer contact required under DPDP.]
