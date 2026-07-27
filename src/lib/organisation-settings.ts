import { prisma } from "./prisma";

export const organisationDefaults = {
  organisationName: "STARS Day Service",
  organisationLegalName: "STARS Day Service",
  organisationAddress: "",
  organisationRegistrationNumber: "",
  organisationLogoUrl: "/branding/stars-logo.svg",
  themePrimary: "#82368c",
  themePrimaryDark: "#54205d",
  themeAccent: "#27778b",
};

export const organisationKeys = Object.keys(organisationDefaults);

export async function getOrganisationSettings() {
  const rows = await prisma.appSetting.findMany({ where: { key: { in: organisationKeys } } });
  return { ...organisationDefaults, ...Object.fromEntries(rows.map((row) => [row.key, row.value])) } as typeof organisationDefaults;
}
