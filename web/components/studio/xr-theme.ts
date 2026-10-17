// Night-studio tokens for in-headset UI (uikit takes colors as values, not CSS variables).
// Same values as the role tokens in web/app/globals.css; change both together.
export const xr = {
  bg: "#0B0C10",
  panel: "#15171E",
  row: "#1B1E27",
  rowHover: "#262A35",
  rowActive: "#0F1116",
  border: "#323745",
  text: "#EEF0F4",
  muted: "#9AA0AD",
  faint: "#6B7180",
  accent: "#9FE7D2",
  onAccent: "#06221B",
  radius: { sm: 8, md: 12, lg: 20 },
  /** px at pixelSize 0.002: 44 px ≈ 9 cm, comfortably bigger than a fingertip */
  hit: 44,
} as const
