if(!process.env.DATABASE_URL?.includes('127.0.0.1:3317/stars_fleet_validation'))throw Error('Disposable local database only');
import {PrismaClient} from '@prisma/client';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const p=new PrismaClient(),origin='http://localhost:3111';let cookie='';
async function request(path,body,method='POST'){const r=await fetch(origin+path,{method:body?method:'GET',headers:{origin,cookie,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const cookies=r.headers.getSetCookie().filter(c=>!c.split(';')[0].endsWith('='));if(cookies.length)cookie=cookies.map(c=>c.split(';')[0]).join('; ');return {status:r.status,data:await r.json()}}
const admin=await p.user.findUnique({where:{username:'fleet-preview'}});let oldLevel;
try{
 assert.equal((await request('/api/auth/login',{identifier:'fleet-preview',password:'FleetPreview2026!'})).status,200);
 const levels=await request('/api/access-levels');assert.equal(levels.status,200);oldLevel=levels.data.find(l=>l.name==='Administrator');await p.user.update({where:{id:admin.id},data:{accessLevelId:oldLevel.id}});
 let result=await request('/api/access-levels',{...oldLevel,permissions:{...oldLevel.permissions,'staff-concerns.review':false}});assert.equal(result.status,200,JSON.stringify(result));assert.equal((await request('/api/access-levels')).status,200,'own session should remain signed in');
 result=await request('/api/access-levels',{...oldLevel,active:false});assert.equal(result.status,200);assert.ok(Object.values(result.data.permissions).every(Boolean));assert.equal((await p.accessLevel.findUnique({where:{id:oldLevel.id}})).active,true);
 let pin;do{pin=String(crypto.randomInt(100000,999999))}while(await p.staffCredential.count({where:{kind:'PIN',lookupHash:crypto.createHash('sha256').update(pin).digest('hex')}}));
 const details={firstName:'Fresh',lastName:'Save Test',displayName:'Fresh save test',email:crypto.randomUUID()+'@example.test',jobRole:'Support Worker',startDate:'2026-01-01',pin,phone:'',profilePhotoUrl:'',payrollNumber:null,contractedWeeklyHours:null,hourlyRate:null,overtimeHourlyRate:null,notes:'',endDate:'',clockingEnabled:true,cameraRequired:false};
 const created=await request('/api/staff',details);assert.equal(created.status,201,JSON.stringify(created));const id=created.data.id;
 result=await request('/api/staff/'+id,{...details,displayName:'Edited save test',jobRole:'Team Leader'},'PATCH');assert.equal(result.status,200,JSON.stringify(result));assert.equal(result.data.jobRole,'Team Leader');assert.equal((await p.user.findUnique({where:{id:result.data.userId}})).role,'TEAM_LEADER');
 result=await request('/api/staff',details);assert.equal(result.status,409);assert.match(result.data.error,/email/);
 result=await request('/api/staff/'+id,{phone:'07000000000'},'PATCH');assert.equal(result.status,200);
 const support=levels.data.find(l=>l.name==='Support Worker');await p.accessLevel.update({where:{id:support.id},data:{active:false}});try{result=await request('/api/staff/'+id,{jobRole:'Support Worker'},'PATCH');assert.equal(result.status,422);assert.match(result.data.error,/disabled/);assert.equal((await p.staffMember.findUnique({where:{id}})).jobRole,'Team Leader')}finally{await p.accessLevel.update({where:{id:support.id},data:{active:support.active}})}
 console.log('PASS own administrator level save, unrestricted administrator permissions, fresh-email/fresh-PIN staff creation, full profile edit with PIN and grade, ordinary edit, useful duplicate/disabled errors.');
}finally{if(oldLevel)await p.accessLevel.update({where:{id:oldLevel.id},data:{permissions:oldLevel.permissions,active:oldLevel.active}});await p.user.update({where:{id:admin.id},data:{accessLevelId:admin.accessLevelId,role:admin.role,permissionOverrides:admin.permissionOverrides||{}}});await p.$disconnect()}
