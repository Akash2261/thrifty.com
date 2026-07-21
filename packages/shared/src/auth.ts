import { z } from "zod";
import { CountrySchema, UserSchema } from "./user";

export const SignupRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  country: CountrySchema,
});
export type SignupRequest = z.infer<typeof SignupRequestSchema>;

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const RefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshRequest = z.infer<typeof RefreshRequestSchema>;

export const AuthResponseSchema = z.object({
  user: UserSchema,
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const RefreshResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type RefreshResponse = z.infer<typeof RefreshResponseSchema>;

// E.164 format, e.g. +919876543210
const PHONE_NUMBER_REGEX = /^\+[1-9]\d{7,14}$/;

export const SendOtpRequestSchema = z.object({
  phoneNumber: z.string().regex(PHONE_NUMBER_REGEX, "Use E.164 format, e.g. +919876543210"),
});
export type SendOtpRequest = z.infer<typeof SendOtpRequestSchema>;

export const VerifyOtpRequestSchema = z.object({
  phoneNumber: z.string().regex(PHONE_NUMBER_REGEX),
  code: z.string().length(6),
  country: CountrySchema,
});
export type VerifyOtpRequest = z.infer<typeof VerifyOtpRequestSchema>;

export const SocialSignInRequestSchema = z.object({
  idToken: z.string().min(1),
  country: CountrySchema,
});
export type SocialSignInRequest = z.infer<typeof SocialSignInRequestSchema>;
