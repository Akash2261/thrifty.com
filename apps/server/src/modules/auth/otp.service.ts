import { randomInt } from "node:crypto";
import { prisma } from "../../db/prisma";
import { AppError } from "../../lib/errors";
import { twilioSmsProvider } from "../../lib/sms";
import { hashPassword, verifyPassword } from "../../lib/password";

const OTP_TTL_MINUTES = 5;
const OTP_RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFY_ATTEMPTS = 5;

function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export async function sendOtp(phoneNumber: string) {
  const recent = await prisma.otpCode.findFirst({
    where: { phoneNumber, createdAt: { gte: new Date(Date.now() - OTP_RESEND_COOLDOWN_SECONDS * 1000) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    throw new AppError("Please wait a moment before requesting another code.", 429);
  }

  const code = generateCode();

  // Send first — persisting the code only after a successful send means a provider failure
  // never leaves behind an unusable code that still counts against the resend cooldown.
  await twilioSmsProvider.sendSms(phoneNumber, `Your Thrifty verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes.`);

  const codeHash = await hashPassword(code);
  await prisma.otpCode.create({
    data: {
      phoneNumber,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    },
  });
}

export async function verifyOtpAndSignIn(phoneNumber: string, code: string) {
  const otp = await prisma.otpCode.findFirst({
    where: { phoneNumber, consumedAt: null, expiresAt: { gte: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!otp) {
    throw new AppError("That code has expired. Request a new one.", 400);
  }
  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new AppError("Too many attempts. Request a new code.", 429);
  }

  const valid = await verifyPassword(code, otp.codeHash);
  if (!valid) {
    await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
    throw new AppError("Incorrect code.", 400);
  }

  await prisma.otpCode.update({ where: { id: otp.id }, data: { consumedAt: new Date() } });

  const user = await prisma.user.upsert({
    where: { phoneNumber },
    create: { phoneNumber, authProvider: "phone" },
    update: {},
  });

  return user;
}
