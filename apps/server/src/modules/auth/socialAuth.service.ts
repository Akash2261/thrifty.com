import { OAuth2Client } from "google-auth-library";
import appleSignin from "apple-signin-auth";
import { prisma } from "../../db/prisma";
import { AppError } from "../../lib/errors";
import type { AuthProvider, Country } from "@thrifty/shared";

async function verifyGoogleIdToken(idToken: string): Promise<{ email: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new AppError("Google sign-in isn't set up yet on the server (missing GOOGLE_CLIENT_ID).", 503);
  }

  const client = new OAuth2Client(clientId);
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    payload = ticket.getPayload();
  } catch (err) {
    throw new AppError("Couldn't verify that Google sign-in. Try again.", 401);
  }

  if (!payload?.email) {
    throw new AppError("That Google account has no email to sign in with.", 400);
  }
  return { email: payload.email };
}

async function verifyAppleIdToken(idToken: string): Promise<{ email: string }> {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId) {
    throw new AppError("Apple sign-in isn't set up yet on the server (missing APPLE_CLIENT_ID).", 503);
  }

  let payload;
  try {
    payload = await appleSignin.verifyIdToken(idToken, { audience: clientId });
  } catch (err) {
    throw new AppError("Couldn't verify that Apple sign-in. Try again.", 401);
  }

  if (!payload.email) {
    throw new AppError(
      "Apple didn't share an email for this sign-in. Try signing in with the method you used originally.",
      400,
    );
  }
  return { email: payload.email };
}

export async function socialSignIn(provider: AuthProvider, idToken: string, country: Country) {
  const { email } =
    provider === "google" ? await verifyGoogleIdToken(idToken) : await verifyAppleIdToken(idToken);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return existing;
  }

  return prisma.user.create({
    data: { email, country, authProvider: provider },
  });
}
