// A single-hue (indigo/slate) monochromatic palette — every color in the app derives from this
// one scale so the UI reads as one cohesive surface. Emphasis comes from lightness/weight, not
// extra hues. The one deliberate exception is `danger`, reserved narrowly for destructive actions
// (sign out, disconnect, delete, leave) — a muted wine tone chosen to sit quietly next to the
// indigo scale rather than clash as a foreign accent, since usability research strongly favors
// keeping "this will delete/remove something" visually distinct from everything else.
export const palette = {
  ink950: "#0B0E1F",
  ink900: "#161B33",
  ink800: "#232A4A",
  ink700: "#333C66",
  ink600: "#4A5488",
  ink500: "#6570A8",
  ink400: "#8891BE",
  ink300: "#AFB6D6",
  ink200: "#D2D6EA",
  ink150: "#E3E6F3",
  ink100: "#EEF0F9",
  ink50: "#F7F8FC",
  white: "#FFFFFF",
  danger: "#8B4A5C",
  dangerBg: "#F6E9EC",
} as const;

export const colors = {
  background: palette.ink50,
  surface: palette.white,
  surfaceAlt: palette.ink100,
  surfaceSelected: palette.ink900,

  border: palette.ink150,
  borderStrong: palette.ink300,

  textPrimary: palette.ink900,
  textSecondary: palette.ink600,
  textMuted: palette.ink400,
  textInverse: palette.white,

  primary: palette.ink900,
  primaryPressed: palette.ink800,
  accent: palette.ink600,
  accentSoft: palette.ink200,

  danger: palette.danger,
  dangerBg: palette.dangerBg,

  shadow: "rgba(11, 14, 31, 0.10)",
} as const;

export const radii = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;

export const typography = {
  title: { fontSize: 26, fontWeight: "700" as const },
  heading: { fontSize: 20, fontWeight: "700" as const },
  subheading: { fontSize: 15, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  caption: { fontSize: 13, fontWeight: "400" as const },
  label: { fontSize: 12, fontWeight: "600" as const, letterSpacing: 0.4 },
};

// Subtle card elevation — shadow color is derived from the same ink scale (not a separate gray),
// so it stays consistent with the rest of the monochromatic surface.
export const cardShadow = {
  shadowColor: palette.ink950,
  shadowOpacity: 0.08,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 2,
};
