import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { track } from "../../src/lib/analytics";
import { colors, spacing } from "../../src/theme/colors";

// Fallback for the email-connections OAuth redirect (thrifty://email-callback). The primary path
// never reaches this screen at all — WebBrowser.openAuthSessionAsync in email-connections.tsx is
// supposed to intercept the redirect entirely in JS and resolve its promise without the OS ever
// handling it as a real deep link. That interception isn't 100% reliable on every Android
// device/browser combination, though — when it doesn't fire, the OS hands the thrifty:// URI to
// the app as a genuine deep link instead, and without a route registered for it, Expo Router's
// unmatched-route screen was the (broken-looking) result. The backend side of the flow has
// already fully succeeded by the time this screen is reached either way (that's what
// `status=success` means) — this just needs to acknowledge it and get the user back to a real
// screen, the same outcome the in-JS success path already produces.
export default function EmailCallbackScreen() {
  const router = useRouter();
  const { status, provider, message } = useLocalSearchParams<{
    status?: string;
    provider?: string;
    message?: string;
  }>();

  useEffect(() => {
    if (status === "success" && provider) {
      track("email_connected", { provider });
    }
    const timer = setTimeout(() => {
      router.replace("/email-connections");
    }, 1200);
    return () => clearTimeout(timer);
  }, [status, provider, router]);

  const isSuccess = status === "success";

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.title}>{isSuccess ? "Connected!" : "Couldn't connect"}</Text>
      <Text style={styles.body}>
        {isSuccess
          ? "Taking you back to your email connections…"
          : (message ?? "Something went wrong. Taking you back…")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    padding: spacing.xxxl,
    backgroundColor: colors.background,
  },
  title: { fontSize: 18, fontWeight: "700", color: colors.textPrimary },
  body: { fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
});
