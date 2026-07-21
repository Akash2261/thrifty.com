import { Tabs } from "expo-router";
import { Text } from "react-native";
import { usePushRegistration } from "../../src/hooks/usePushRegistration";
import { colors } from "../../src/theme/colors";

function TabIcon({ symbol, focused }: { symbol: string; focused: boolean }) {
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{symbol}</Text>;
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
        options={{ title: "Home", tabBarIcon: ({ focused }) => <TabIcon symbol="🏠" focused={focused} /> }}
      />
      <Tabs.Screen
        name="warranty"
        options={{ title: "Warranty", tabBarIcon: ({ focused }) => <TabIcon symbol="🧾" focused={focused} /> }}
      />
      <Tabs.Screen
        name="substop"
        options={{ title: "SubStop", tabBarIcon: ({ focused }) => <TabIcon symbol="💳" focused={focused} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: "Settings", tabBarIcon: ({ focused }) => <TabIcon symbol="⚙️" focused={focused} /> }}
      />
      <Tabs.Screen name="email-connections" options={{ title: "Connect email", href: null }} />
      <Tabs.Screen name="email-review" options={{ title: "Review receipts", href: null }} />
      <Tabs.Screen name="whatsapp-link" options={{ title: "Link WhatsApp", href: null }} />
      <Tabs.Screen name="claims" options={{ title: "Claims", href: null }} />
      <Tabs.Screen name="household" options={{ title: "Household", href: null }} />
      <Tabs.Screen name="data-usage" options={{ title: "Your data", href: null }} />
    </Tabs>
  );
}
