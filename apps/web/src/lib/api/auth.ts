import type { LoginRequest, SendOtpRequest, SignupRequest, User, VerifyOtpRequest } from "@thrifty/shared";
import { authorizedRequest, request } from "./client";

interface SessionResult {
  user: User;
}

export function login(payload: LoginRequest) {
  return request<SessionResult>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
}

export function signup(payload: SignupRequest) {
  return request<SessionResult>("/api/auth/signup", { method: "POST", body: JSON.stringify(payload) });
}

export function sendOtp(payload: SendOtpRequest) {
  return request<{ sent: true }>("/api/auth/otp/send", { method: "POST", body: JSON.stringify(payload) });
}

export function verifyOtp(payload: VerifyOtpRequest) {
  return request<SessionResult>("/api/auth/otp/verify", { method: "POST", body: JSON.stringify(payload) });
}

export function logout() {
  return request<{ signedOut: true }>("/api/auth/logout", { method: "POST" });
}

export function fetchMe() {
  return authorizedRequest<SessionResult>("/auth/me");
}

export function deleteAccount() {
  return authorizedRequest<{ deleted: true }>("/auth/account", { method: "DELETE" });
}
