export const themePresets = {
  default: { label: "Default", primary: "#82368c", header: "#54205d", accent: "#27778b" },
  red: { label: "Red", primary: "#b33a3a", header: "#762525", accent: "#c15d32" },
  blue: { label: "Blue", primary: "#3069a6", header: "#20466f", accent: "#27778b" },
  green: { label: "Green", primary: "#3f7954", header: "#295038", accent: "#2f7d73" },
  orange: { label: "Orange", primary: "#c4662d", header: "#7d401f", accent: "#a44949" },
  slate: { label: "Slate", primary: "#586579", header: "#354052", accent: "#39738a" },
} as const;

export type ThemePresetId = keyof typeof themePresets;

export function isThemePreset(value: string): value is ThemePresetId {
  return Object.prototype.hasOwnProperty.call(themePresets, value);
}
