export const DEVICE_STALE_AFTER_MS = 15 * 60_000;
export const DEVICE_SETUP_CODE_TTL_MS = 15 * 60_000;
export type DeviceOperationalStatus = "ACTIVE" | "STALE" | "REVOKED";
export function deviceOperationalStatus(device:{status:"ACTIVE"|"REVOKED";lastSeenAt:Date|string|null},now=new Date()):DeviceOperationalStatus{
 if(device.status==="REVOKED")return "REVOKED";
 if(device.lastSeenAt&&new Date(device.lastSeenAt).getTime()<now.getTime()-DEVICE_STALE_AFTER_MS)return "STALE";
 return "ACTIVE";
}
export function setupCodeIsUsable(code:{expiresAt:Date|string;consumedAt:Date|string|null},now=new Date()){
 return !code.consumedAt&&new Date(code.expiresAt).getTime()>now.getTime();
}