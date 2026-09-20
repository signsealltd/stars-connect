import {NextRequest,NextResponse} from "next/server";
import {prisma} from "@/lib/prisma";
import {withVehicle,canReviewFleet} from "@/lib/fleet-auth";
import {jsonError} from "@/lib/api";
import {simplePdf} from "@/lib/documents";
import {audit} from "@/lib/audit";
import type {CheckRecord} from "@/components/vehicle-check-record";
const csv=(v:unknown)=>`"${String(v??"").replace(/^[=+@-]/,"'$&").replaceAll('"','""')}"`;
export async function GET(req:NextRequest){return withVehicle(req,async user=>{
 const q=req.nextUrl.searchParams,id=q.get("id"),manager=await canReviewFleet();
 if(id){const row=await prisma.vehicleCheck.findUnique({where:{id}});if(!row||(!manager&&row.userId!==user.id))return jsonError("Check not found.",404);const s=row.snapshot as unknown as CheckRecord["snapshot"];
 const lines=[`${s.vehicle.name} - ${s.vehicle.registration}`,`Staff: ${row.staffName}`,`Mileage: ${row.mileage} | Outcome: ${row.outcome}`,`Device start: ${row.clientStartedAt.toISOString()}`,`Server submission: ${row.submittedAt.toISOString()}`,`Record: ${row.id}`,`Checklist: ${row.checklistVersion} | Declaration: ${row.declarationVersion}`,"",...s.answers.flatMap(a=>[`${a.label}: ${a.response}${a.severity?` (${a.severity})`:""}`,...(a.notes?[a.notes]:[]),...(a.response==="DEFECT"?a.imageIds.map(i=>`Private evidence reference: ${i}`):[])]),"",s.declaration,"Evidence photographs are available in the authenticated check detail view."];
 const wrapped=lines.flatMap(l=>l.match(/.{1,92}(?:\s|$)|.{1,92}/g)||[""]);await audit("VEHICLE_CHECK_EXPORTED",{actorType:"USER",actorId:user.id,entityType:"VehicleCheck",entityId:id});return new NextResponse(simplePdf("Daily vehicle check",wrapped),{headers:{"content-type":"application/pdf","content-disposition":`attachment; filename="vehicle-check-${id}.pdf"`,"cache-control":"private, no-store"}});}
 if(!manager)return jsonError("Fleet review permission required.",403);
 const from=q.get("from")||"",to=q.get("to")||"";if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||to<from||new Date(to).getTime()-new Date(from).getTime()>366*86400000)return jsonError("Select a date range of up to one year.",422);
 const rows=await prisma.vehicleCheck.findMany({where:{checkDate:{gte:new Date(from),lte:new Date(to)}},orderBy:{submittedAt:"asc"},take:10001});if(rows.length>10000)return jsonError("Choose a smaller range (maximum 10,000 checks).",422);
 const content=[["ID","Vehicle","Registration","Staff","Date","Mileage","Outcome","Server received"],...rows.map(r=>{const s=r.snapshot as unknown as CheckRecord["snapshot"];return [r.id,s.vehicle.name,s.vehicle.registration,r.staffName,r.checkDate.toISOString().slice(0,10),r.mileage,r.outcome,r.submittedAt.toISOString()]})].map(r=>r.map(csv).join(",")).join("\r\n");await audit("VEHICLE_CHECKS_EXPORTED",{actorType:"USER",actorId:user.id,afterValue:{from,to,count:rows.length}});return new NextResponse(content,{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":"attachment; filename=vehicle-checks.csv","cache-control":"private, no-store"}});
});}
