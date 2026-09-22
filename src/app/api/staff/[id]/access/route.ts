import {NextRequest} from "next/server";
import {withCapability,jsonError} from "@/lib/api";
import {CAPABILITIES} from "@/lib/permissions";
export async function PUT(req:NextRequest){return withCapability(req,CAPABILITIES.USERS_MANAGE,async()=>jsonError("Access levels now follow the job title in the staff profile. Manage invitations in Staff Portal → Access.",410))}
