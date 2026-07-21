import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import { Link, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSession } from "../src/ctx/auth";
import { ApiError } from "../src/api/client";
import { track } from "../src/lib/analytics";
import { colors, radii, spacing } from "../src/theme/colors";

export default function SignInScreen() {
  const router = useRouter();
  const { signIn, signInWithGoogle, signInWithApple } = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAppleAvailable, setIsAppleAvailable] = useState(false);

  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  // The current platform's relevant client ID is required just to construct this hook — it
  // throws synchronously (crashing the whole screen) if missing, so a placeholder keeps the
  // hook alive when unconfigured; `isGoogleConfigured` below hides the button in that case so
  // nobody can actually trigger a request built from the placeholder.
  const isGoogleConfigured = Platform.select({
    ios: !!googleIosClientId,
    android: !!googleAndroidClientId,
    default: !!googleClientId,
  });
  const [, googleResponse, promptGoogleSignIn] = Google.useIdTokenAuthRequest({
    clientId: googleClientId || "not-configured",
    iosClientId: googleIosClientId || "not-configured",
    androidClientId: googleAndroidClientId || "not-configured",
  });

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setIsAppleAvailable);
  }, []);

  useEffect(() => {
    if (googleResponse?.type === "success" && googleResponse.params.id_token) {
      signInWithGoogle(googleResponse.params.id_token)
        .then(() => track("signup_completed", { method: "google" }))
        .catch((err) => {
          const message = err instanceof ApiError ? err.message : "Couldn't sign in with Google.";
          Alert.alert("Google sign-in failed", message);
        });
    }
  }, [googleResponse]);

  async function handleSubmit() {
    setIsSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to sign in";
      Alert.alert("Sign in failed", message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleAppleSignIn() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });
      if (!credential.identityToken) {
        throw new Error("Apple didn't return an identity token");
      }
      await signInWithApple(credential.identityToken);
      track("signup_completed", { method: "apple" });
    } catch (err: any) {
      if (err?.code === "ERR_REQUEST_CANCELED") return;
      const message = err instanceof ApiError ? err.message : "Couldn't sign in with Apple.";
      Alert.alert("Apple sign-in failed", message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Thrifty</Text>
      <Text style={styles.subtitle}>Track warranties. Stop paying for subscriptions you forgot.</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={styles.button} onPress={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.buttonText}>Sign in</Text>}
      </Pressable>

      {isGoogleConfigured && (
        <Pressable style={styles.secondaryButton} onPress={() => promptGoogleSignIn()}>
          <Text style={styles.secondaryButtonText}>Continue with Google</Text>
        </Pressable>
      )}

      {Platform.OS === "ios" && isAppleAvailable && (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={10}
          style={styles.appleButton}
          onPress={handleAppleSignIn}
        />
      )}

      <Pressable style={styles.secondaryButton} onPress={() => router.push("/phone-sign-in")}>
        <Text style={styles.secondaryButtonText}>Continue with phone number</Text>
      </Pressable>

      <Link href="/sign-up" style={styles.link}>
        Don&apos;t have an account? Sign up
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: spacing.xxl, gap: spacing.md, backgroundColor: colors.background },
  title: { fontSize: 34, fontWeight: "700", textAlign: "center", color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.sm, lineHeight: 21 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  buttonText: { color: colors.textInverse, fontSize: 16, fontWeight: "600" },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
  },
  secondaryButtonText: { color: colors.textPrimary, fontSize: 15, fontWeight: "600" },
  appleButton: { height: 48 },
  link: { textAlign: "center", marginTop: spacing.lg, color: colors.accent, fontWeight: "500" },
});
