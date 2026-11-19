/* eslint-disable @typescript-eslint/no-require-imports */
// End-to-end API checks against the isolated fictional MariaDB fixtures only.
const {request}=require('playwright');
const {PrismaClient}=require('@prisma/client');
const {randomUUID,createPublicKey,publicEncrypt,createCipheriv,randomBytes,createHmac,constants}=require('crypto');
const sharp=require('sharp');
const fs=require('fs');const assert=require('assert/strict');
const base=process.env.MYDAY_QA_URL||'http://127.0.0.1:3128',dburl=new URL(process.env.DATABASE_URL||'mysql://invalid/invalid');
if(dburl.hostname!=='127.0.0.1'||dburl.port!=='3317'||dburl.pathname!=='/stars_myday_disposable'||!base.startsWith('http://127.0.0.1:'))throw Error('Disposable QA environment required.');
const fixture=JSON.parse(fs.readFileSync('tmp/myday-qa/fixture.json','utf8')),db=new PrismaClient();
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const observation=text=>({id:randomUUID(),requestKey:randomUUID(),studentId:fixture.clients[0].id,occurredAt:new Date().toISOString(),content:{kind:'GENERAL',text,activity:'',alternative:'',choiceText:'',score:null,ratingMethod:null,handover:true}});
const canonical=value=>Array.isArray(value)?`[${value.map(canonical).join(",")}]`:value&&typeof value==="object"?`{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`:JSON.stringify(value);
const seal=(submission,grant)=>{const signature=createHmac('sha256',grant.secret).update(canonical(submission)).digest('hex'),key=randomBytes(32),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([cipher.update(JSON.stringify({grantId:grant.id,secret:grant.secret,signature,submission})),cipher.final(),cipher.getAuthTag()]);return {key:publicEncrypt({key:createPublicKey({key:grant.publicKey,format:'jwk'}),oaepHash:'sha256',padding:constants.RSA_PKCS1_OAEP_PADDING},key).toString('base64'),iv:iv.toString('base64'),ciphertext:data.toString('base64')};};
(async()=>{
 const contexts=[];try{
 const create=async()=>{const c=await request.newContext({baseURL:base,extraHTTPHeaders:{Origin:base}});contexts.push(c);return c;};
 const anonymous=await create(),staff=await create(),other=await create(),admin=await create();
 assert.equal((await anonymous.get('/api/myday')).status(),401);
 assert.equal((await staff.post('/api/myday/auth',{data:{pin:'0000'}})).status(),401);
 const login=await staff.post('/api/myday/auth',{data:{pin:'1234'}});assert.equal(login.status(),200,await login.text());const {grant}=await login.json();
 assert.equal((await other.post('/api/myday/auth',{data:{pin:'5678'}})).status(),200);
 assert.equal((await admin.post('/api/auth/login',{data:{identifier:'myday-qa-manager',password:'fictional-manager-password'}})).status(),200);
 assert.equal((await staff.get('/api/myday/admin')).status(),403);
 const beforeEntries=await db.myDayEntry.count({where:{day:today()}});
 const before=await db.studentAttendance.findMany(),profiles=await db.student.findMany({orderBy:{id:'asc'}});
 const directory=await (await staff.get('/api/myday')).json();assert.equal(directory.clients.length,3);assert.equal(directory.activities.length,0);assert.equal(directory.clients[0].name,'Adam Brooks');assert.equal(directory.clients.find(c=>c.name==='Nina Ellis').allergies,'not recorded');
 const a=observation('Live API fictional observation.'),b=observation('Covering worker contribution.');
 const saveA=await staff.post('/api/myday',{data:a});assert.equal(saveA.status(),200,await saveA.text());
 assert.equal((await other.post('/api/myday',{data:b})).status(),200);
 assert.equal((await staff.post('/api/myday',{data:a})).status(),200);
 assert.equal(await db.myDayEntry.count({where:{day:today()}}),beforeEntries+2);
 assert.deepEqual(await db.studentAttendance.findMany(),before);assert.deepEqual(await db.student.findMany({orderBy:{id:'asc'}}),profiles);
 assert.equal((await other.post('/api/myday',{data:{...a,requestKey:randomUUID(),baseVersion:1}})).status(),403);
 const edited={...a,requestKey:randomUUID(),baseVersion:1,content:{...a.content,text:'Reviewed author correction.'}};assert.equal((await staff.post('/api/myday',{data:edited})).status(),200);
 const conflict=await (await staff.post('/api/myday',{data:{...a,requestKey:randomUUID(),baseVersion:1}})).json();assert.equal(conflict.review,true);
 // Narrow replay needs no active staff cookie and remains bound to its original author.
 const offline=observation('Sealed offline observation.');const sealed=seal(offline,grant);await staff.delete('/api/myday/auth');
 const syncResponse=await anonymous.post('/api/myday/sync',{data:sealed});assert.equal(syncResponse.status(),200,await syncResponse.text());assert.equal((await db.myDayEntry.findUnique({where:{id:offline.id}})).authorId,fixture.workerId);
 assert.equal((await anonymous.post('/api/myday/sync',{data:sealed})).status(),200);
 const revoked=observation('Held after access revocation.');await db.staffMember.update({where:{id:fixture.workerId},data:{active:false}});
 const held=await (await anonymous.post('/api/myday/sync',{data:seal(revoked,grant)})).json();assert.equal(held.review,true);assert.equal(await db.myDayEntry.findUnique({where:{id:revoked.id}}),null);await db.staffMember.update({where:{id:fixture.workerId},data:{active:true}});
 const accepted=await admin.post('/api/myday/admin',{data:{action:'review',id:revoked.requestKey,decision:'ACCEPT'}});assert.equal(accepted.status(),200,await accepted.text());assert.equal((await db.myDayReview.findUnique({where:{id:revoked.requestKey}})).status,'ACCEPTED');
 await staff.post('/api/myday/auth',{data:{pin:'1234'}});
 await admin.post('/api/myday/admin',{data:{action:'visibility',studentId:a.studentId,hidden:true}});
 assert.equal((await staff.post('/api/myday',{data:observation('Blocked hidden entry.')})).status(),403);
 assert.equal((await staff.get(`/api/myday?client=${a.studentId}`)).status(),403);
 const marked=await staff.get(`/api/myday?client=${a.studentId}&note=${a.id}`);assert.equal(marked.status(),200);assert.deepEqual((await marked.json()).client.plan,{});
 await admin.post('/api/myday/admin',{data:{action:'visibility',studentId:a.studentId,hidden:false}});
 const late=observation('Yesterday late sync.');late.occurredAt=new Date(Date.now()-86400_000).toISOString();await staff.post('/api/myday',{data:late});const markers=await (await staff.get('/api/myday/markers')).json();assert.ok(!markers.notes.some(n=>n.id===late.id));
 const planClient=fixture.clients[1].id,planBefore=(await db.student.findUnique({where:{id:planClient}})).personCentredProfile.communication,planAfter=planBefore==='Offer two clear choices.'?'Allow time to respond.':'Offer two clear choices.';assert.equal((await staff.patch('/api/myday',{data:{studentId:planClient,section:'communication',before:planBefore,text:planAfter,key:randomUUID()}})).status(),200);
 assert.equal((await other.patch('/api/myday',{data:{studentId:planClient,section:'communication',before:planBefore,text:'Competing outdated change.',key:randomUUID()}})).status(),409);
 assert.equal((await db.student.findUnique({where:{id:planClient}})).personCentredProfile.communication,planAfter);
 const legacyClient=fixture.clients[2].id;await db.student.update({where:{id:legacyClient},data:{personCentredProfile:{communication:'Allow time to respond.',additionalNotes:'An existing older note.'}}});
 const addNote=await staff.patch('/api/myday',{data:{studentId:legacyClient,section:'additionalNotes',before:'',text:'A new attributed note.',key:randomUUID()}});assert.equal(addNote.status(),200,await addNote.text());const legacyPlan=(await db.student.findUnique({where:{id:legacyClient}})).personCentredProfile;assert.equal(legacyPlan.additionalNotes,'An existing older note.');assert.equal(legacyPlan.mydayAdditionalNotes[0].text,'A new attributed note.');
 const png=await sharp({create:{width:128,height:128,channels:3,background:'#b991c6'}}).png().toBuffer(),oldPhoto=(await db.student.findUnique({where:{id:a.studentId}})).profilePhotoUrl||'';
 const photoUpload=()=>staff.post('/api/myday/photo?client='+a.studentId,{multipart:{photo:{name:'fictional-profile.png',mimeType:'image/png',buffer:png},previous:oldPhoto}});
 if(!await db.studentConsentHistory.findFirst({where:{studentId:a.studentId,consentType:'photography'}}))assert.equal((await photoUpload()).status(),403);
 await db.studentConsentHistory.create({data:{studentId:a.studentId,consentType:'photography',newValue:{internalCareRecords:true,none:false},providedByName:'Fictional QA parent',providedAt:new Date(),approvedById:fixture.managerId,approvedAt:new Date()}});
 const upload=await photoUpload();assert.equal(upload.status(),200,await upload.text());const canonicalPhoto=(await db.student.findUnique({where:{id:a.studentId}})).profilePhotoUrl;
 assert.ok(canonicalPhoto.includes('/api/students/'));assert.equal((await staff.get('/api/myday/photo?client='+a.studentId)).status(),200);assert.equal((await admin.get(canonicalPhoto)).status(),200);assert.equal((await anonymous.get('/api/myday/photo?client='+a.studentId)).status(),401);
 const broken=await staff.post('/api/myday/photo?client='+a.studentId,{multipart:{photo:{name:'broken.png',mimeType:'image/png',buffer:Buffer.from('not an image')},previous:canonicalPhoto}});assert.equal(broken.status(),422);assert.equal((await db.student.findUnique({where:{id:a.studentId}})).profilePhotoUrl,canonicalPhoto);
 const month=today().slice(0,7),source=await (await admin.get(`/api/myday/report?client=${a.studentId}&month=${month}`)).json();
 const report={studentId:a.studentId,month,version:source.report?.version||0,sourceHash:source.sourceHash,action:'save',replaceConfirmed:!!source.report,content:{opening:'Maya chose dominoes.',activities:'Maya joined the games table.',enjoyment:'No enjoyment rating was recorded.',support:'We offered a choice of activities.'}};
 const saved=await admin.post('/api/myday/report',{data:report});assert.equal(saved.status(),200,await saved.text());assert.equal((await admin.get(`/api/myday/report?client=${a.studentId}&pdf=1`)).headers()['content-type'],'application/pdf');
 const oldPdf=Buffer.from((await db.myDayReport.findUnique({where:{studentId:a.studentId}})).pdf);
 assert.equal((await admin.post('/api/myday/report',{data:report})).status(),409);
 const overflowing={...report,version:report.version+1,replaceConfirmed:true,content:{...report.content,opening:'A detailed observation. '.repeat(130)}};assert.equal((await admin.post('/api/myday/report',{data:overflowing})).status(),422);assert.deepEqual(Buffer.from((await db.myDayReport.findUnique({where:{studentId:a.studentId}})).pdf),oldPdf);
 await staff.post('/api/myday',{data:observation('New source after report generation.')});assert.equal((await (await admin.get(`/api/myday/report?client=${a.studentId}&month=${month}`)).json()).report.stale,true);
 await db.appSetting.upsert({where:{key:'mydayEnabled'},create:{key:'mydayEnabled',value:false},update:{value:false}});assert.equal((await staff.get('/api/myday')).status(),404);await db.appSetting.update({where:{key:'mydayEnabled'},data:{value:true}});
 // The queue's private RSA key must be protected by the existing settings key.
 const keys=(await db.appSetting.findUnique({where:{key:'mydayQueueEncryption'}})).value;assert.ok(keys.privateKeyCipher);assert.ok(!JSON.stringify(keys).includes('PRIVATE KEY'));
 console.log(JSON.stringify({passed:true,checks:['anonymous and manager isolation','PIN credentials','empty activity library','alphabetical service directory','no attendance/profile side effects','two authors','retry deduplication','edit ownership','competing edit review','signed-out replay','revocation review and admin acceptance','hidden-client direct-request rejection','hidden current register-note access','late-sync marker isolation','canonical plan, legacy note preservation and stale-edit rejection','photo permission, canonical reuse, private access and failed replacement','one-page PDF save and download','concurrent and overflowing report preservation','changed-source flag','pilot-off','encrypted server private key']}));
 }finally{await Promise.all(contexts.map(c=>c.dispose()));await db.$disconnect();}
})().catch(e=>{console.error(e);process.exitCode=1});
