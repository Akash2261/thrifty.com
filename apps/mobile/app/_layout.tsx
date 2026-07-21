import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../src/ctx/auth";
import { initSentry } from "../src/lib/sentry";
import { identify, initAnalytics } from "../src/lib/analytics";

initSentry();
initAnalytics();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { user, isLoading } = useSession();

  useEffect(() => {
    if (user) identify(user.id);
  }, [user?.id]);

  if (isLoading) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="phone-sign-in" />
      </Stack.Protected>
    </Stack>
  );
}
