if(!process.env.DATABASE_URL?.includes('127.0.0.1:3317/stars_fleet_validation'))throw Error('Disposable local database only');
import {PrismaClient} from '@prisma/client';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const p=new PrismaClient(),origin='http://localhost:3111';let cookie='';
async function request(path,body,method='POST'){const r=await fetch(origin+path,{method:body?method:'GET',headers:{origin,cookie,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});for(const c of r.headers.getSetCookie()){if(c.startsWith('stars_session='))cookie=c.split(';')[0]}return {status:r.status,data:await r.json()}}
try{
 const login=await request('/api/auth/login',{identifier:'fleet-preview',password:'FleetPreview2026!'});assert.equal(login.status,200); // Recover cookie name used by the management app.
 if(!cookie){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({identifier:'fleet-preview',password:'FleetPreview2026!'})});cookie=r.headers.getSetCookie().filter(c=>!c.split(';')[0].endsWith('=')).map(c=>c.split(';')[0]).join('; ')}
 const levels=await request('/api/access-levels');assert.equal(levels.status,200);assert.deepEqual(levels.data.map(l=>l.name).sort(),['Administrator','Assistant Manager','Manager','Team Leader','Support Worker'].sort());
 const created=await request('/api/staff',{firstName:'Grade',lastName:'Test',displayName:'Synthetic grade test',email:crypto.randomUUID()+'@example.test',jobRole:'Support Worker',startDate:'2026-01-01'});assert.equal(created.status,201,JSON.stringify(created));const staff=created.data;assert.ok(staff.userId);const account=await p.user.findUnique({where:{id:staff.userId}});assert.equal(account.accessLevelId,levels.data.find(l=>l.name==='Support Worker').id);assert.equal(await p.staffPortalAccount.count({where:{staffId:staff.id}}),0);
 await p.session.create({data:{userId:account.id,tokenHash:crypto.randomBytes(32).toString('hex'),expiresAt:new Date(Date.now()+60000)}});
 const changed=await request('/api/staff/'+staff.id,{jobRole:'Assistant Manager'},'PATCH');assert.equal(changed.status,200,JSON.stringify(changed));const after=await p.user.findUnique({where:{id:account.id}});assert.equal(after.accessLevelId,levels.data.find(l=>l.name==='Assistant Manager').id);assert.equal(after.passwordHash,account.passwordHash);assert.equal(await p.session.count({where:{userId:account.id}}),0);
 assert.equal((await request('/api/staff/'+staff.id,{jobRole:'Arbitrary title'},'PATCH')).status,422);
 assert.equal((await request('/api/staff/'+staff.id+'/access',{accessLevelId:account.accessLevelId},'PUT')).status,410);
 const recognised=await p.staffMember.findMany({where:{jobRole:{in:['Support Worker','Assistant Manager','Manager','Team Leader','Administrator']}}});assert.ok(recognised.every(s=>s.accessLevelId||s.email.includes('@example.test')));
 console.log('PASS five grades, migrated titles, automatic linked account assignment, grade change, session revocation, password preservation, invalid title and obsolete assignment rejection.');
}finally{await p.$disconnect()}
