import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// expo-secure-store wraps the iOS Keychain / Android Keystore and has no web
// implementation, so the web build (also deployed for real, not just local
// preview) falls back to localStorage instead of crashing.
const isWeb = Platform.OS === "web";

export const ACCESS_TOKEN_KEY = "thrifty.accessToken";
export const REFRESH_TOKEN_KEY = "thrifty.refreshToken";

export async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
