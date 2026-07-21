import { Twilio } from "twilio";
import { AppError } from "./errors";

export interface SmsProvider {
  sendSms(phoneNumber: string, body: string): Promise<void>;
}

let twilioClient: Twilio | null = null;

function getTwilioClient(): Twilio {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) {
      throw new AppError("Phone sign-in isn't set up yet on the server (missing Twilio credentials).", 503);
    }
    twilioClient = new Twilio(accountSid, authToken);
  }
  return twilioClient;
}

export const twilioSmsProvider: SmsProvider = {
  async sendSms(phoneNumber, body) {
    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    if (!fromNumber) {
      throw new AppError("Phone sign-in isn't set up yet on the server (missing TWILIO_FROM_NUMBER).", 503);
    }
    const client = getTwilioClient();
    try {
      await client.messages.create({ to: phoneNumber, from: fromNumber, body });
    } catch (err) {
      console.error("Twilio SMS send failed", err);
      throw new AppError("Couldn't send that verification code. Try again.", 502);
    }
  },
};
