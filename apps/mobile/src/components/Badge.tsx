import { StyleSheet, Text, View } from "react-native";
import { colors, radii } from "../theme/colors";

type BadgeTone = "neutral" | "accent" | "urgent";

const TONE_STYLES: Record<BadgeTone, { bg: string; text: string }> = {
  neutral: { bg: colors.surfaceAlt, text: colors.textSecondary },
  accent: { bg: colors.accentSoft, text: colors.textPrimary },
  urgent: { bg: colors.dangerBg, text: colors.danger },
};

// A real pill-shaped chip (background + padding + rounded corners) — replaces the plain bold
// text that used to stand in for "urgent"/"flagged" state across the list screens.
export function Badge({ label, tone = "neutral" }: { label: string; tone?: BadgeTone }) {
  const { bg, text } = TONE_STYLES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: { fontSize: 12, fontWeight: "700" },
});
