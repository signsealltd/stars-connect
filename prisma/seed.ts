import { PrismaClient, Role, AttendanceStatus, ClockEventType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "crypto";

const prisma = new PrismaClient();
const hash = (value:string) => createHash("sha256").update(value).digest("hex");
const staffNames = ["Amelia Hart","Ben Carter","Chloe Martin","Daniel Reed","Ella Brooks","Finley Ward","Grace Cooper","Harry Evans","Isla Turner","Jack Collins"];
const studentNames = ["Ava Wilson","Blake Taylor","Casey Moore","Daisy Lewis","Elliot King","Freya Walker","George Hall","Holly Allen","Isaac Young","Jasmine Wright","Kai Scott","Lily Green","Mason Baker","Nina Adams","Oscar Nelson","Poppy Hill","Quinn Campbell","Ruby Mitchell","Sam Roberts","Tia Phillips"];

async function main() {
  for (const [email,name,role] of [
    ["admin@starsconnect.test","Alex Admin",Role.ADMINISTRATOR],
    ["director@starsconnect.test","Dana Director",Role.DIRECTOR],
    ["manager@starsconnect.test","Morgan Manager",Role.MANAGER],
    ["reception@starsconnect.test","Riley Reception",Role.RECEPTION],
  ] as const) {
    await prisma.user.upsert({
      where:{email},
      update:{name,role,active:true},
      create:{email,name,role,passwordHash:await bcrypt.hash("ChangeMe!123",12)},
    });
  }

  const devices = [];
  for (const [index,name] of ["Reception Tablet","Activity Room Tablet"].entries()) {
    const token = `development-tablet-token-${index + 1}-change-before-production`;
    const tokenHash = hash(token);
    const existing = await prisma.device.findUnique({where:{tokenHash}});
    devices.push(existing ? await prisma.device.update({where:{id:existing.id},data:{name,isSeedData:true,status:"REVOKED",revokedAt:existing.revokedAt||new Date(),pendingEventCount:0}}) : await prisma.device.create({data:{name,tokenHash,appVersion:"1.0.0",tokenRotatedAt:new Date(),isSeedData:true,status:"REVOKED",revokedAt:new Date()}}));
    console.log(`${name} development token: ${token}`);
  }

  const staff = [];
  for (let i=0;i<staffNames.length;i++) {
    const [firstName,lastName] = staffNames[i].split(" ");
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.test`;
    const member = await prisma.staffMember.upsert({
      where:{email},
      update:{displayName:staffNames[i],active:true,clockingEnabled:true,payrollNumber:`PAY-${String(i+1).padStart(3,"0")}`},
      create:{firstName,lastName,displayName:staffNames[i],email,jobRole:i<2?"Team Leader":"Support Worker",startDate:new Date("2024-01-08"),contractedWeeklyHours:35,payrollNumber:`PAY-${String(i+1).padStart(3,"0")}`},
    });
    const pin = String(4101+i);
    const lookupHash = hash(pin);
    const credential = await prisma.staffCredential.findFirst({where:{staffId:member.id,kind:"PIN",lookupHash}});
    if (!credential) await prisma.staffCredential.create({data:{staffId:member.id,kind:"PIN",valueHash:await bcrypt.hash(pin,12),lookupHash}});
    staff.push(member);
  }

  const students = [];
  for (let i=0;i<studentNames.length;i++) {
    const [firstName,lastName] = studentNames[i].split(" ");
    const internalReference = `STU-${String(i+1).padStart(3,"0")}`;
    students.push(await prisma.student.upsert({
      where:{internalReference},
      update:{displayName:studentNames[i],active:true,billingReference:`BILL-${String(i+1).padStart(3,"0")}`},
      create:{firstName,lastName,displayName:studentNames[i],expectedDays:[1,2,3,4,5],active:true,startDate:new Date("2024-09-02"),internalReference,fundingCategory:i%2?"Local authority":"Direct payment",fundingOrganisation:"Example Council",billingReference:`BILL-${String(i+1).padStart(3,"0")}`},
    }));
  }

  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
  for (let i=0;i<6;i++) {
    const existing = await prisma.clockEvent.findFirst({where:{staffId:staff[i].id,deviceTimestamp:{gte:day}}});
    if (!existing) await prisma.clockEvent.create({data:{id:randomUUID(),staffId:staff[i].id,deviceId:devices[0].id,type:ClockEventType.CLOCK_IN,deviceTimestamp:new Date(day.getTime()+(8*60+30+i*4)*60_000),photoStatus:"NOT_REQUIRED"}});
  }
  for (let i=0;i<students.length;i++) {
    await prisma.studentAttendance.upsert({
      where:{studentId_date:{studentId:students[i].id,date:day}},
      update:{},
      create:{id:randomUUID(),studentId:students[i].id,deviceId:devices[0].id,date:day,status:i<14?AttendanceStatus.PRESENT:i<17?AttendanceStatus.ABSENT:AttendanceStatus.NOT_MARKED,arrivalTime:i<14?new Date(day.getTime()+(9*60+i)*60_000):null,deviceTimestamp:now},
    });
  }

  const visitorReasons = ["Electrical","Fire safety","Plumbing","Maintenance","Delivery","Contractor","Professional visit","Personal visit","Meeting","Other"];
  for (const [sortOrder,label] of visitorReasons.entries()) await prisma.visitorReason.upsert({where:{label},update:{sortOrder,active:true},create:{label,sortOrder,active:true}});
  const activeRules = await prisma.visitorRuleSet.findFirst({where:{active:true}});
  if (!activeRules) await prisma.visitorRuleSet.create({data:{version:1,title:"Visitor site rules",rulesText:"Please remain with your host unless instructed otherwise. Follow all fire, emergency and safeguarding instructions. Do not photograph or record people on site. Report hazards immediately and wear any required protective equipment. Sign out before leaving the site.",active:true}});
  for (const [key,value] of Object.entries({
    cameraMode:"OPTIONAL",photoRetentionDays:30,auditRetentionDays:365,localHistoryDays:7,
    rollCallRetentionDays:730,duplicateEventSeconds:20,dailyEmailEnabled:false,
    dailyEmailTime:"17:30",dailyEmailRecipients:[],dailyReportEnabled:false,dailyReportTime:"00:05",dailyReportTo:[],dailyReportCc:[],dailyReportBcc:[],dailyReportIncludePdf:true,dailyReportIncludeCsv:false,dailyReportIncludeStudents:true,dailyReportIncludeStaff:true,dailyReportIncludeVisitors:true,dailyReportVisitorTelephone:false,dailyReportVisitorEmail:false,dailyReportVisitorVehicle:false,dailyReportOnlyWhenActivity:false,dailyReportExceptionsWhenEmpty:true,dailyReportSubject:"STARS Connect daily attendance report — {{date}}",
    visitorCompanyRequired:false,visitorMobileRequired:false,visitorVehicleRequired:false,visitorDurationRequired:false,
    visitorRecordRetentionDays:730,visitorSignatureRetentionDays:30,visitorPhoneRetentionDays:30,attendanceRetentionDays:2555,generatedReportRetentionDays:2555,payrollDocumentRetentionDays:2555,invoiceRetentionDays:2555,invoicePrefix:"STARS",organisationLegalName:"STARS Day Service",organisationAddress:"",companyNumber:"",vatNumber:"",bankDetails:"",remittanceInstructions:"",defaultPaymentTerms:"Payment is due by the date shown.",
  })) await prisma.appSetting.upsert({where:{key},update:{},create:{key,value}});

  console.log("Seed complete. Fake logins use ChangeMe!123; development staff PINs are 4101–4110.");
}

main().finally(()=>prisma.$disconnect());
