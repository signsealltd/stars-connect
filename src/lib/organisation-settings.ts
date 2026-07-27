import { prisma } from "./prisma";
import { isThemePreset, themePresets } from "./theme-presets";

export const organisationDefaults = {
  organisationName: "STARS Day Service",
  organisationLegalName: "STARS Day Service",
  organisationAddress: "",
  organisationRegistrationNumber: "",
  organisationLogoUrl: "/branding/stars-logo.svg",
  themePreset: "default",
  themePrimary: themePresets.default.primary,
  themePrimaryDark: themePresets.default.header,
  themeAccent: themePresets.default.accent,
};

export const organisationKeys = Object.keys(organisationDefaults);

export async function getOrganisationSettings() {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: organisationKeys } } });
  const settings = { ...organisationDefaults, ...Object.fromEntries(rows.map((row) => [row.key, row.value])) } as typeof organisationDefaults;
  const theme = isThemePreset(settings.themePreset) ? themePresets[settings.themePreset] : themePresets.default;
  return { ...settings, themePreset: isThemePreset(settings.themePreset) ? settings.themePreset : "default", themePrimary: theme.primary, themePrimaryDark: theme.header, themeAccent: theme.accent };
}
