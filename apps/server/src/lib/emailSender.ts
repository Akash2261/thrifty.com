import { ServerClient } from "postmark";
import { AppError } from "./errors";

let client: ServerClient | null = null;
function getClient(): ServerClient {
  if (!client) {
    const token = process.env.POSTMARK_SERVER_TOKEN;
    if (!token) {
      throw new AppError("Sending cancellation emails isn't set up yet on the server (missing POSTMARK_SERVER_TOKEN).", 503);
    }
    client = new ServerClient(token);
  }
  return client;
}

export async function sendEmail(params: { to: string; replyTo: string; subject: string; textBody: string }) {
  const from = process.env.CANCELLATION_FROM_EMAIL;
  if (!from) {
    throw new AppError("Sending cancellation emails isn't set up yet on the server (missing CANCELLATION_FROM_EMAIL).", 503);
  }

  const postmark = getClient();
  try {
    await postmark.sendEmail({
      From: from,
      To: params.to,
      ReplyTo: params.replyTo,
      Subject: params.subject,
      TextBody: params.textBody,
    });
  } catch (err) {
    console.error("Postmark send failed", err);
    throw new AppError("Couldn't send that email. Try again.", 502);
  }
}
