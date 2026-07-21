import Constants from "expo-constants";
import { Platform } from "react-native";
import type {
  AuthResponse,
  LoginRequest,
  RefreshResponse,
  SendOtpRequest,
  SignupRequest,
  SocialSignInRequest,
  User,
  VerifyOtpRequest,
} from "@thrifty/shared";

function resolveBaseUrl(): string {
  // Set per EAS build profile (see eas.json's `env`) so a production build points at the real
  // deployed backend without editing app.json by hand before every release.
  const envOverride = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envOverride) {
    return envOverride;
  }

  const configured = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;
  if (configured && configured !== "http://localhost:4000") {
    return configured;
  }
  // The Android emulator can't reach the host machine via `localhost`.
  if (Platform.OS === "android") {
    return "http://10.0.2.2:4000";
  }
  return configured ?? "http://localhost:4000";
}

export const API_BASE_URL = resolveBaseUrl();

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = typeof body?.error === "string" ? body.error : "Something went wrong";
    throw new ApiError(response.status, message);
  }

  return body as T;
}

export function signup(payload: SignupRequest) {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload: LoginRequest) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function refresh(refreshToken: string) {
  return request<RefreshResponse>("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
}

export function fetchMe(accessToken: string) {
  return request<{ user: User }>("/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export function sendOtp(payload: SendOtpRequest) {
  return request<{ sent: true }>("/auth/otp/send", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function verifyOtp(payload: VerifyOtpRequest) {
  return request<AuthResponse>("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function signInWithGoogle(payload: SocialSignInRequest) {
  return request<AuthResponse>("/auth/google", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function signInWithApple(payload: SocialSignInRequest) {
  return request<AuthResponse>("/auth/apple", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
