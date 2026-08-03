// Ported from apps/mobile/src/theme/colors.ts so the web app shares the same visual language.
// Keep in sync with the @theme block in app/globals.css, which is the source Tailwind reads from
// — this file exists for the rare case JS needs a raw color value (e.g. an inline SVG fill)
// rather than a Tailwind class.
//
// A single-hue (indigo/slate) monochromatic palette — every color derives from this one scale so
// the UI reads as one cohesive surface. The one deliberate exception is `danger`, reserved for
// destructive actions (sign out, disconnect, delete, leave) — a muted wine tone chosen to sit
// quietly next to the indigo scale rather than clash as a foreign accent.
export const palette = {
  slate950: "#0B0E1F",
  slate900: "#161B33",
  slate800: "#232A4A",
  slate700: "#333C66",
  slate600: "#4A5488",
  slate500: "#6570A8",
  slate400: "#8891BE",
  slate300: "#AFB6D6",
  slate200: "#D2D6EA",
  slate150: "#E3E6F3",
  slate100: "#EEF0F9",
  slate50: "#F7F8FC",
  white: "#FFFFFF",
  danger: "#8B4A5C",
  dangerBg: "#F6E9EC",
} as const;

export const colors = {
  page: palette.slate50,
  surface: palette.white,
  surfaceAlt: palette.slate100,
  surfaceSelected: palette.slate900,

  border: palette.slate150,
  borderStrong: palette.slate300,

  textPrimary: palette.slate900,
  textSecondary: palette.slate600,
  textMuted: palette.slate400,
  textInverse: palette.white,

  primary: palette.slate900,
  primaryPressed: palette.slate800,
  accent: palette.slate600,
  accentSoft: palette.slate200,

  danger: palette.danger,
  dangerBg: palette.dangerBg,
} as const;

export const radii = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;
