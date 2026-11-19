/* eslint-disable @typescript-eslint/no-require-imports */
// Synthetic, intercepted UI acceptance checks. No live client data or database.
// Run with NODE_PATH pointing to a Playwright installation and a local dev server.
const {chromium}=require('playwright');
const {generateKeyPairSync,privateDecrypt,createDecipheriv,constants}=require('crypto');
const sharp=require('sharp');
const fs=require('fs');
const assert=require('assert/strict');
const base=process.env.MYDAY_QA_URL||'http://127.0.0.1:3128';
const pair=generateKeyPairSync('rsa',{modulusLength:2048});
const clientId='33333333-3333-4333-8333-333333333333';
const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const actor={id:'worker-a',name:'Alex M.',admin:false};
const client={id:clientId,name:'Maya Reed',search:'Maya Reed',photo:null,photoDocumentUrl:'',allergies:'Peanuts',requirements:'Halal meals',preferences:'Vegetarian options',halal:true,hidden:false,handover:[],plan:{communication:'Use clear language and allow time to respond.',goals:'Choose activities independently.',additionalNotes:[]}};
const grant={id:'11111111-1111-4111-8111-111111111111',secret:'synthetic-authorisation-secret',expiresAt:'2099-01-01T00:00:00Z',publicKey:pair.publicKey.export({format:'jwk'})};
let entries=[],signedIn=false,offline=false,photoFails=true,photoSaves=0;
function opened(envelope){const key=privateDecrypt({key:pair.privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(envelope.key,'base64')),bytes=Buffer.from(envelope.ciphertext,'base64'),d=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));d.setAuthTag(bytes.subarray(-16));return JSON.parse(Buffer.concat([d.update(bytes.subarray(0,-16)),d.final()]).toString());}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const photoBytes=await sharp({create:{width:128,height:128,channels:3,background:'#b991c6'}}).png().toBuffer();
  const context=await browser.newContext({viewport:{width:800,height:1100},deviceScaleFactor:1});const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url()),path=url.pathname;
   if(offline&&path.startsWith('/api/myday')&&path!='/api/myday/auth')return route.abort('internetdisconnected');
   const send=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(path==='/api/branding')return send({themePrimary:'#82368c',themePrimaryDark:'#54205d',themeAccent:'#7c3990'});
   if(path==='/api/myday/auth'){if(req.method()==='POST')signedIn=true;if(req.method()==='DELETE')signedIn=false;return send({enabled:true,actor:signedIn?actor:null,grant:signedIn?grant:null});}
   if(path==='/api/myday/grant')return send({grant});
   if(path==='/api/myday/sync'){const {submission:s}=opened(req.postDataJSON());const current=entries.find(e=>e.id===s.id);entries=entries.filter(e=>e.id!==s.id);entries.push({...s,day:date,authorId:actor.id,authorName:actor.name,handover:s.content.handover,version:(current?.version||0)+1,editedBy:current?actor.name:null});return send({saved:true});}
   if(path==='/api/myday/photo'&&req.method()==='POST'){if(photoFails)return send({error:'Synthetic upload failure — previous picture retained.'},503);photoSaves++;client.photo='/api/myday/photo?client='+clientId+'&v='+photoSaves;client.photoDocumentUrl='/api/students/'+clientId+'/photo?document=synthetic-photo-'+photoSaves;return send({saved:true});}
   if(path==='/api/myday/photo')return route.fulfill({contentType:'image/png',body:photoBytes});
   if(path==='/api/myday'){
    if(req.method()==='PATCH'){const v=req.postDataJSON();client.plan[v.section]=v.text;return send({saved:true});}
    if(url.searchParams.has('client'))return send({client,entries,history:[]});
    return send({actor,clients:[client,{...client,id:'44444444-4444-4444-8444-444444444444',name:'Adam Brooks',search:'Adam Brooks',allergies:'not recorded',halal:false,handover:[]}],activities:[]});
   }
   return send({},401);
  });
  await page.goto(base+'/myday');await page.getByLabel('Staff PIN').fill('1234');await page.getByRole('button',{name:'Open My Day',exact:true}).click();await page.getByRole('button',{name:/Maya Reed/}).waitFor();
  fs.mkdirSync('tmp/myday-qa',{recursive:true});await page.screenshot({path:'tmp/myday-qa/directory.png',fullPage:true});
  assert.equal(entries.length,0,'Opening the directory must not create entries');
  await page.getByRole('button',{name:/Maya Reed/}).click();await page.getByRole('button',{name:'Add first update'}).click();await page.getByLabel('What happened?').fill('Maya chose the games table.');await page.getByRole('button',{name:'Save update',exact:true}).click();await page.getByRole('button',{name:'Save update',exact:true}).waitFor({state:'hidden'});await page.getByText('Maya chose the games table.',{exact:true}).waitFor();assert.equal(entries.length,1);
  await page.getByRole('button',{name:'Add activity',exact:true}).click();await page.getByLabel('Activity offered').fill('Karaoke');await page.getByRole('button',{name:'Declined',exact:true}).click();await page.getByLabel('Was anything else offered?').fill('Dominoes');await page.getByLabel('What did they choose?').selectOption('Other');await page.getByLabel('Their choice',{exact:true}).fill('An earlier choice');await page.getByLabel('What did they choose?').selectOption('Joined the alternative');await page.getByText('Enjoyment rating (optional)',{exact:true}).click();await page.getByRole('button',{name:'8 out of 10 — Enjoyed it',exact:true}).click();await page.getByLabel('Entered by staff for client',{exact:true}).check();await page.getByLabel('Handover needed').check();await page.screenshot({path:'tmp/myday-qa/declined.png',fullPage:true});await page.getByRole('button',{name:'Save update',exact:true}).click();await page.getByRole('button',{name:'Save update',exact:true}).waitFor({state:'hidden'});await page.getByText('Alternative offered:',{exact:true}).waitFor();assert.equal(entries[1].content.choiceText,'');assert.equal(entries[1].content.alternative,'Dominoes');assert.equal(entries[1].content.score,8);assert.equal(entries[1].handover,true);
  await page.getByRole('button',{name:'My plan',exact:true}).click();await page.getByText('Use clear language and allow time to respond.',{exact:true}).waitFor();await page.getByRole('button',{name:'Edit',exact:true}).first().click();await page.locator('.myday-plan-section textarea').fill('Offer two clear choices.');await page.getByRole('button',{name:'Save section',exact:true}).click();await page.getByText('Offer two clear choices.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Today',exact:true}).click();await page.getByRole('button',{name:'Change photo for Maya Reed'}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(photoSaves,0);
  photoFails=false;await page.getByRole('button',{name:'Change photo for Maya Reed'}).click();await page.locator('input[type=file]').nth(1).setInputFiles({name:'fictional.png',mimeType:'image/png',buffer:photoBytes});await page.getByRole('button',{name:'Save photo',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});assert.equal(photoSaves,1);const savedPhoto=client.photo;
  photoFails=true;await page.getByRole('button',{name:'Change photo for Maya Reed'}).click();await page.locator('input[type=file]').nth(1).setInputFiles({name:'fictional.png',mimeType:'image/png',buffer:photoBytes});await page.getByRole('button',{name:'Save photo',exact:true}).click();await page.getByText('Synthetic upload failure — previous picture retained.',{exact:true}).waitFor();assert.equal(client.photo,savedPhoto);await page.getByRole('button',{name:'Cancel',exact:true}).click();

  offline=true;await page.getByRole('button',{name:'Add update',exact:true}).click();await page.getByLabel('What happened?').fill('Protected pending observation.');await page.getByRole('button',{name:'Save update',exact:true}).click();await page.getByRole('button',{name:'Save update',exact:true}).waitFor({state:'hidden'});await page.getByText('Protected pending observation.',{exact:true}).waitFor();assert.equal(entries.length,2);await page.getByRole('button',{name:'Lock / Switch staff'}).click();assert.equal(await page.getByText('Protected pending observation.',{exact:true}).count(),0);
  const queueContents=await page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('stars-myday-protected',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return new Promise(resolve=>{const r=db.transaction('queue').objectStore('queue').getAll();r.onsuccess=()=>{resolve(JSON.stringify(r.result));db.close()}})});assert.ok(!queueContents.includes('Protected pending observation.'));
  await page.reload();await page.getByLabel('Staff PIN').waitFor();offline=false;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForFunction(()=>!document.body.textContent.includes('1 protected update(s) waiting to sync'));assert.equal(entries.length,3);assert.equal(entries[2].authorName,'Alex M.');
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,checks:['PIN access','directory identity and unknown allergies','read-only opening','general update','declined alternative rating','independent handover flag','shared plan edit','photo cancellation, successful crop and failed replacement','encrypted offline save','lock privacy','reload persistence and original-author reconnect'],entries:entries.length,pageErrors:errors,screenshots:'tmp/myday-qa'}));
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
