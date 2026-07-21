import { Stack } from "expo-router";

export default function SubStopStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "SubStop" }} />
      <Stack.Screen name="cancel" options={{ title: "Cancel subscription" }} />
      <Stack.Screen name="aa-consent" options={{ title: "Link your bank" }} />
    </Stack>
  );
}
