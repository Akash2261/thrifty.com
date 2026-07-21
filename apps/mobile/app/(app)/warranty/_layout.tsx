import { Stack } from "expo-router";

export default function WarrantyStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Warranty Wallet" }} />
      <Stack.Screen name="[id]" options={{ title: "Item" }} />
    </Stack>
  );
}
