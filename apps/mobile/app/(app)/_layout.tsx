import { Ionicons } from "@react-native-vector-icons/ionicons";
import type { IoniconsIconName } from "@react-native-vector-icons/ionicons";
import { Tabs } from "expo-router";
import { usePushRegistration } from "../../src/hooks/usePushRegistration";
import { colors } from "../../src/theme/colors";

// Outline glyph when inactive, filled glyph when focused — the standard iOS/Android tab-bar
// convention, and a much clearer "you are here" signal than the previous opacity-only change.
function TabIcon({ name, focused }: { name: IoniconsIconName; focused: boolean }) {
  return (
    <Ionicons name={focused ? name : (`${name}-outline` as IoniconsIconName)} size={22} color={focused ? colors.textPrimary : colors.textMuted} />
  );
}

export default function AppTabsLayout() {
  usePushRegistration(true);

  return (
    <Tabs
      screenOptions={{
        headerTitleAlign: "center",
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.textPrimary },
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} /> }}
      />
      <Tabs.Screen
        name="warranty"
        options={{ title: "Warranty", tabBarIcon: ({ focused }) => <TabIcon name="receipt" focused={focused} /> }}
      />
      <Tabs.Screen
        name="substop"
        options={{ title: "SubStop", tabBarIcon: ({ focused }) => <TabIcon name="card" focused={focused} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} /> }}
      />
      <Tabs.Screen name="email-connections" options={{ title: "Connect email", href: null }} />
      <Tabs.Screen name="email-review" options={{ title: "Review receipts", href: null }} />
      <Tabs.Screen name="email-callback" options={{ title: "Connecting…", href: null }} />
      <Tabs.Screen name="whatsapp-link" options={{ title: "Link WhatsApp", href: null }} />
      <Tabs.Screen name="claims" options={{ title: "Claims", href: null }} />
      <Tabs.Screen name="household" options={{ title: "Household", href: null }} />
      <Tabs.Screen name="data-usage" options={{ title: "Your data", href: null }} />
    </Tabs>
  );
}
