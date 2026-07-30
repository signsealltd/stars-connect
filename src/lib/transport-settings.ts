import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
export type PayrollRoundingMode="NONE"|"NEAREST"|"UP"|"DOWN";
export const TRANSPORT_DEFAULTS={clockInAllowanceMinutes:30,clockOutAllowanceMinutes:30,roundingIntervalMinutes:15,roundingMode:"NEAREST" as PayrollRoundingMode};
export type TransportSettings=typeof TRANSPORT_DEFAULTS;
export async function getTransportSettings():Promise<TransportSettings>{const rows=await prisma.appSetting.findMany({where:{key:{in:Object.keys(TRANSPORT_DEFAULTS)}}}),values=Object.fromEntries(rows.map(row=>[row.key,row.key==="roundingMode"?String(row.value):Number(row.value)]));return{...TRANSPORT_DEFAULTS,...values}as TransportSettings}
export async function saveTransportSettings(values:TransportSettings,userId:string){await prisma.$transaction(Object.entries(values).map(([key,value])=>prisma.appSetting.upsert({where:{key},update:{value:value as Prisma.InputJsonValue,updatedBy:userId},create:{key,value:value as Prisma.InputJsonValue,updatedBy:userId}})))}
export function roundNearest(minutes:number,interval=15){return Math.round(minutes/interval)*interval}
export function roundPayroll(minutes:number,interval=15,mode:PayrollRoundingMode="NEAREST"){if(mode==="NONE")return minutes;if(mode==="UP")return Math.ceil(minutes/interval)*interval;if(mode==="DOWN")return Math.floor(minutes/interval)*interval;return roundNearest(minutes,interval)}
