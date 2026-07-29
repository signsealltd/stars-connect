import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
export const TRANSPORT_DEFAULTS={clockInAllowanceMinutes:30,clockOutAllowanceMinutes:30,roundingIntervalMinutes:15};
export type TransportSettings=typeof TRANSPORT_DEFAULTS;
export async function getTransportSettings():Promise<TransportSettings>{const rows=await prisma.appSetting.findMany({where:{key:{in:Object.keys(TRANSPORT_DEFAULTS)}}});return{...TRANSPORT_DEFAULTS,...Object.fromEntries(rows.map(row=>[row.key,Number(row.value)]))}}
export async function saveTransportSettings(values:TransportSettings,userId:string){await prisma.$transaction(Object.entries(values).map(([key,value])=>prisma.appSetting.upsert({where:{key},update:{value:value as Prisma.InputJsonValue,updatedBy:userId},create:{key,value:value as Prisma.InputJsonValue,updatedBy:userId}})))}
export function roundNearest(minutes:number,interval=15){return Math.round(minutes/interval)*interval}
