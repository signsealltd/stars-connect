import packageInfo from "../../package.json";

// package.json is the authoritative application release version.
export const APP_VERSION = packageInfo.version;
export const APP_VERSION_LABEL = `V${APP_VERSION}`;
