import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Self-service cancellation pages for well-known subscription services. These are safe to seed
// because they're just public URLs — worst case a stale one lands the user on a login/help page,
// not a wrong destination for a real action.
//
// Deliberately NOT seeded: any `method: "email"` entries. Sending a cancellation email requires a
// verified contact address for that specific company, and guessing one risks emailing a wrong or
// fabricated address. Add real `email` rows here only once you've confirmed the company actually
// accepts email cancellation and you have their real contact — e.g.:
//
//   { merchantPattern: "example gym", displayName: "Example Gym", method: "email",
//     cancellationEmail: "verified-real-address@example.com",
//     instructions: "Confirmed via their help center on 2026-01-01: ..." }
const KNOWN_SERVICES: Array<{
  merchantPattern: string;
  displayName: string;
  method: "self_service_url" | "email";
  selfServiceUrl?: string;
  instructions: string;
}> = [
  {
    merchantPattern: "netflix",
    displayName: "Netflix",
    method: "self_service_url",
    selfServiceUrl: "https://www.netflix.com/cancelplan",
    instructions: "Sign in, then tap Cancel Membership on this page.",
  },
  {
    merchantPattern: "spotify",
    displayName: "Spotify",
    method: "self_service_url",
    selfServiceUrl: "https://www.spotify.com/account/subscription/",
    instructions: "Sign in, then choose Cancel Premium under your subscription.",
  },
  {
    merchantPattern: "disney plus",
    displayName: "Disney+",
    method: "self_service_url",
    selfServiceUrl: "https://www.disneyplus.com/account",
    instructions: "Sign in, then go to Subscription and select Cancel Subscription.",
  },
  {
    merchantPattern: "hulu",
    displayName: "Hulu",
    method: "self_service_url",
    selfServiceUrl: "https://www.hulu.com/account",
    instructions: "Sign in, then go to Your Subscription and select Cancel.",
  },
  {
    merchantPattern: "amazon prime",
    displayName: "Amazon Prime",
    method: "self_service_url",
    selfServiceUrl: "https://www.amazon.com/prime",
    instructions: "Sign in, then go to Manage Membership > End Membership.",
  },
  {
    merchantPattern: "youtube premium",
    displayName: "YouTube Premium",
    method: "self_service_url",
    selfServiceUrl: "https://www.youtube.com/paid_memberships",
    instructions: "Sign in, then select Deactivate next to your membership.",
  },
  {
    merchantPattern: "apple",
    displayName: "Apple Subscription",
    method: "self_service_url",
    selfServiceUrl: "https://apps.apple.com/account/subscriptions",
    instructions:
      "Apple bills Apple Music/TV+/iCloud+ through your Apple ID — manage or cancel here.",
  },
  {
    merchantPattern: "max com",
    displayName: "Max (HBO)",
    method: "self_service_url",
    selfServiceUrl: "https://www.max.com/account",
    instructions: "Sign in, then go to Billing and select Cancel Subscription.",
  },
  {
    merchantPattern: "audible",
    displayName: "Audible",
    method: "self_service_url",
    selfServiceUrl: "https://www.audible.com/account",
    instructions: "Sign in, then go to Membership Details to cancel.",
  },
  {
    merchantPattern: "adobe",
    displayName: "Adobe Creative Cloud",
    method: "self_service_url",
    selfServiceUrl: "https://account.adobe.com/plans",
    instructions: "Sign in, then manage or cancel your plan here.",
  },
  {
    merchantPattern: "dropbox",
    displayName: "Dropbox",
    method: "self_service_url",
    selfServiceUrl: "https://www.dropbox.com/account",
    instructions: "Sign in, then go to Plan to cancel your subscription.",
  },
  {
    merchantPattern: "nytimes",
    displayName: "The New York Times",
    method: "self_service_url",
    selfServiceUrl: "https://myaccount.nytimes.com",
    instructions: "Sign in, then go to Subscription to cancel.",
  },
  {
    merchantPattern: "playstation",
    displayName: "PlayStation Plus",
    method: "self_service_url",
    selfServiceUrl: "https://www.playstation.com/en-us/subscriptions/",
    instructions: "Sign in with your PSN account, then manage or cancel PS Plus here.",
  },
  {
    merchantPattern: "xbox",
    displayName: "Xbox Game Pass",
    method: "self_service_url",
    selfServiceUrl: "https://account.microsoft.com/services",
    instructions: "Sign in, then find Game Pass under Services & subscriptions to cancel.",
  },
];

// ServiceCenterContact (warranty-claim contacts) intentionally ships with zero rows for the same
// reason KnownService ships with zero `email` rows above — a wrong phone number/email for
// something as consequential as a warranty claim is worse than no directory entry at all. Add
// real rows here only once you've verified a manufacturer's actual service-center contact, e.g.:
//
//   { merchantPattern: "example brand", displayName: "Example Brand Support",
//     contactMethod: "phone", contactValue: "+1-800-555-0100",
//     instructions: "Verified via their support page on 2026-01-01: ..." }
const SERVICE_CENTER_CONTACTS: Array<{
  merchantPattern: string;
  displayName: string;
  contactMethod: string;
  contactValue: string;
  instructions: string;
}> = [];

async function main() {
  for (const service of KNOWN_SERVICES) {
    await prisma.knownService.upsert({
      where: { merchantPattern: service.merchantPattern },
      create: service,
      update: service,
    });
  }
  console.log(`Seeded ${KNOWN_SERVICES.length} known services.`);

  for (const contact of SERVICE_CENTER_CONTACTS) {
    await prisma.serviceCenterContact.upsert({
      where: { merchantPattern: contact.merchantPattern },
      create: contact,
      update: contact,
    });
  }
  console.log(`Seeded ${SERVICE_CENTER_CONTACTS.length} service center contacts.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
