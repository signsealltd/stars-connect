import { prisma } from "./prisma";
import { isThemePreset, themePresets } from "./theme-presets";

export type OrganisationLogo = { id: string; name: string; url: string };

export const organisationDefaults = {
  organisationName: "STARS Day Service",
  organisationLegalName: "STARS Day Service",
  organisationAddress: "",
  organisationLogoUrl: "/branding/stars-logo.svg",
  organisationLogos: [
    { id: "stars-default", name: "STARS default", url: "/branding/stars-logo.svg" },
  ] as OrganisationLogo[],
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
  const logos = Array.isArray(settings.organisationLogos) && settings.organisationLogos.length
    ? settings.organisationLogos
    : organisationDefaults.organisationLogos;
  const organisationLogoUrl = logos.some((logo) => logo.url === settings.organisationLogoUrl)
    ? settings.organisationLogoUrl
    : logos[0].url;
  return {
    ...settings,
    organisationLogos: logos,
    organisationLogoUrl,
    themePreset: isThemePreset(settings.themePreset) ? settings.themePreset : "default",
    themePrimary: theme.primary,
    themePrimaryDark: theme.header,
    themeAccent: theme.accent,
  };
}
