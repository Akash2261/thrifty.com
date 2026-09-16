import { Ionicons } from "@react-native-vector-icons/ionicons";
import type { IoniconsIconName } from "@react-native-vector-icons/ionicons";
import { StyleSheet, View } from "react-native";
import { colors } from "../theme/colors";

export type RowIconKind = "warranty" | "return" | "subscription";

const ICON_NAME: Record<RowIconKind, IoniconsIconName> = {
  warranty: "shield-checkmark-outline",
  return: "arrow-undo-outline",
  subscription: "card-outline",
};

// A small tinted circular icon leading each list row — gives Home/Warranty/SubStop rows a way to
// be scanned by shape/color at a glance instead of only by reading each line of text.
export function RowIcon({ kind }: { kind: RowIconKind }) {
  return (
    <View style={styles.circle}>
      <Ionicons name={ICON_NAME[kind]} size={18} color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
});
