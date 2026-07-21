import { AppError } from "../../lib/errors";
import type { EmailProviderClient } from "./emailProvider";

// Yahoo's OAuth2 identity flow (login.yahoo.com) is public and works fine for verifying which
// Yahoo Mail address a user owns. What doesn't exist is a public, documented Yahoo Mail *read*
// API for third-party apps — Yahoo shut down general developer access to Mail data years ago and
// only grandfathered/enterprise partners retain it. Rather than fake a message feed, this
// provider is honest about that boundary: it can complete the OAuth handshake and record the
// connected address, but listing/reading messages throws a clear error instead of pretending to
// work. See accountAggregatorProvider.ts for the same pattern applied to India bank data.
const AUTH_URL = "https://api.login.yahoo.com/oauth2/request_auth";
const TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";
const USERINFO_URL = "https://api.login.yahoo.com/openid/v1/userinfo";

function getCredentials() {
  const clientId = process.env.YAHOO_CLIENT_ID;
  const clientSecret = process.env.YAHOO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new AppError(
      "Yahoo connection isn't set up yet on the server (missing YAHOO_CLIENT_ID/SECRET).",
      503,
    );
  }
  return { clientId, clientSecret };
}

export const yahooProvider: EmailProviderClient = {
  getAuthUrl(state, redirectUri) {
    const { clientId } = getCredentials();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email",
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode(code, redirectUri) {
    const { clientId, clientSecret } = getCredentials();
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({
        code,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!response.ok) {
      console.error("Yahoo token exchange failed", await response.text());
      throw new AppError("Couldn't finish connecting your Yahoo account. Try again.", 502);
    }
    const data = (await response.json()) as { access_token: string; refresh_token?: string; expires_in: number };

    const userinfo = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    });
    if (!userinfo.ok) {
      throw new AppError("Couldn't read that Yahoo account's address. Try again.", 502);
    }
    const { email } = (await userinfo.json()) as { email: string };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? null,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      emailAddress: email,
      scope: "openid email",
    };
  },

  async refreshAccessToken(refreshToken) {
    const { clientId, clientSecret } = getCredentials();
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${basicAuth}`,
      },
      body: new URLSearchParams({ refresh_token: refreshToken, grant_type: "refresh_token" }),
    });
    if (!response.ok) {
      console.error("Yahoo token refresh failed", await response.text());
      throw new AppError("Your Yahoo connection expired. Reconnect it in Settings.", 401);
    }
    const data = (await response.json()) as { access_token: string; expires_in: number };
    return { accessToken: data.access_token, expiresAt: new Date(Date.now() + data.expires_in * 1000) };
  },

  async listNewMessages() {
    throw new AppError(
      "Yahoo Mail doesn't offer a public read API for third-party apps anymore, so Thrifty can't " +
        "scan Yahoo inboxes for receipts. Your Yahoo account is connected for identification only " +
        "— use Gmail, Outlook, or manual/forwarded receipts instead.",
      501,
    );
  },
};
