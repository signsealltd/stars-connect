// Only for the freshly created disposable, loopback-only QA database.
// Never loads a production backup or seeds an existing application database.
import {PrismaClient,type Student} from "@prisma/client";
import bcrypt from "bcryptjs";
import {createHash,randomUUID} from "crypto";
import {readFileSync,writeFileSync,mkdirSync} from "fs";
import {saveMydayEntry} from "../src/lib/myday-service";
import {submissionSchema,mydayCanonicalJson} from "../src/lib/myday-rules";
const url=new URL(process.env.DATABASE_URL||"mysql://invalid/invalid");
if(url.hostname!=="127.0.0.1"||url.port!=="3317"||url.pathname!=="/stars_myday_disposable")throw Error("Refusing to run outside the named disposable QA database.");
const db=new PrismaClient();
async function main(){
 if(await db.student.count()||await db.staffMember.count()||await db.organisation.count())throw Error("QA database must be empty before fixtures are created.");
 const org=await db.organisation.create({data:{name:"Fictional My Day QA Service",slug:"myday-qa"}});
 const worker=await db.staffMember.create({data:{firstName:"Alex",lastName:"Morgan",displayName:"Alex M.",email:"alex@example.invalid",jobRole:"Support Worker",startDate:new Date("2026-01-01")}});
 const covering=await db.staffMember.create({data:{firstName:"Jo",lastName:"Lane",displayName:"Jo L.",email:"jo@example.invalid",jobRole:"Support Worker",startDate:new Date("2026-01-01")}});
 for(const [staff,pin] of [[worker,"1234"],[covering,"5678"]] as const)await db.staffCredential.create({data:{staffId:staff.id,kind:"PIN",lookupHash:createHash("sha256").update(pin).digest("hex"),valueHash:await bcrypt.hash(pin,4)}});
 const manager=await db.user.create({data:{username:"myday-qa-manager",name:"Fictional Manager",passwordHash:await bcrypt.hash("fictional-manager-password",4),role:"ADMINISTRATOR",organisationId:org.id}});
 const clients:Student[]=[];
 for(const [name,medical] of [["Maya Reed",{allergies:"Peanuts",dietaryRequirements:"Halal meals",halal:true}],["Adam Brooks",{allergies:"No known allergies"}],["Nina Ellis",{}]] as const)clients.push(await db.student.create({data:{firstName:name.split(" ")[0],lastName:name.split(" ")[1],displayName:name,expectedDays:[1,2,3,4,5],startDate:new Date("2026-01-01"),medicalProfile:medical,personCentredProfile:{communication:"Allow time to respond.",goals:"Choose activities independently."}}}));
 await db.studentAttendance.create({data:{id:randomUUID(),deviceId:(await db.device.create({data:{name:"Fictional QA tablet",tokenHash:createHash("sha256").update(randomUUID()).digest("hex")}})).id,studentId:clients[0].id,date:new Date("2026-01-01"),status:"PRESENT",deviceTimestamp:new Date("2026-01-01T10:00:00Z"),arrivalTime:new Date("2026-01-01T10:00:00Z"),version:1}});
 const snapshot=async()=>mydayCanonicalJson({clients:await db.student.findMany({orderBy:{id:"asc"}}),staff:await db.staffMember.findMany({orderBy:{id:"asc"}}),attendance:await db.studentAttendance.findMany(),users:await db.user.findMany(),orgs:await db.organisation.findMany()});
 const before=await snapshot(),migration=readFileSync("prisma/migrations/20261119120000_myday_pilot/migration.sql","utf8");
 for(const sql of migration.split(";").map(s=>s.trim()).filter(Boolean))await db.$executeRawUnsafe(sql);
 if(before!==await snapshot())throw Error("The additive migration changed an existing record.");
 const actor={id:worker.id,staffId:worker.id,name:worker.displayName,organisationId:org.id,admin:false},other={...actor,id:covering.id,staffId:covering.id,name:covering.displayName};
 const make=(text:string)=>submissionSchema.parse({id:randomUUID(),requestKey:randomUUID(),studentId:clients[0].id,occurredAt:"2026-01-01T10:00:00.000Z",content:{kind:"GENERAL",text,handover:true}});
 const a=make("Chose dominoes."),b=make("Asked for a quiet break.");
 // Distinct writers must commit separately without sharing a mutable day blob.
 await Promise.all([saveMydayEntry(actor,a),saveMydayEntry(other,b)]);
 await saveMydayEntry(actor,a);
 if(await db.myDayEntry.count()!==2)throw Error("Retry duplicated an entry or a contribution was lost.");
 const edited={...a,requestKey:randomUUID(),baseVersion:1,content:{...a.content,text:"Chose dominoes and invited a friend."}};
 await saveMydayEntry(actor,edited);
 const conflict=await saveMydayEntry(actor,{...a,requestKey:randomUUID(),baseVersion:1,content:{...a.content,text:"Delayed competing edit."}});
 if(!conflict.review||(await db.myDayEntry.findUniqueOrThrow({where:{id:a.id}})).version!==2)throw Error("Concurrent edit was not preserved for review.");
 if(before!==await snapshot())throw Error("Diary writes changed a profile or attendance record.");
 mkdirSync("tmp/myday-qa",{recursive:true});writeFileSync("tmp/myday-qa/fixture.json",JSON.stringify({organisationId:org.id,workerId:worker.id,coveringId:covering.id,managerId:manager.id,clients:clients.map(c=>({id:c.id,name:c.displayName}))},null,2));
 console.log(JSON.stringify({passed:true,checks:["real MariaDB additive migration","existing records byte-equivalent","two-worker persistence","MySQL JSON retry idempotency","revision retention","competing-edit review","attendance and profiles unchanged"],database:"loopback disposable QA database"}));
}
main().finally(()=>db.$disconnect()).catch(e=>{console.error(e);process.exitCode=1});
