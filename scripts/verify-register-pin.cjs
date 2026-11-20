/* eslint-disable @typescript-eslint/no-require-imports */
// Regression: a My Day staff session must not unlock the separate register.
const {chromium}=require('playwright');
const assert=require('assert/strict');
const base=process.env.MYDAY_QA_URL||'http://127.0.0.1:3128';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base))throw Error('Use a local QA server.');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:800,height:1100},serviceWorkers:'block'});
  await context.addInitScript(()=>{localStorage.setItem('pulse-device-id','fictional-tablet');localStorage.setItem('pulse-device-token','fictional-device-token')});
  const page=await context.newPage(),errors=[];let unlocks=0;
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   const send=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(url.pathname==='/api/auth/me')return send({error:'No manager session'},401);
   if(url.pathname==='/api/branding')return send({themePrimary:'#82368c',themePrimaryDark:'#54205d',themeAccent:'#82368c'});
   // Deliberately keep an existing My Day identity available throughout.
   if(url.pathname==='/api/myday/auth')return send({enabled:true,actor:{id:'fictional-worker',name:'Alex M.',admin:false}});
   if(url.pathname==='/api/register/unlock'){
    unlocks++;
    assert.equal(req.headers()['x-device-id'],'fictional-tablet');
    return req.postDataJSON().pin==='1234'?send({ok:true,displayName:'Alex M.'}):send({error:'PIN not recognised'},401);
   }
   if(url.pathname==='/api/students')return send([{id:'33333333-3333-4333-8333-333333333333',displayName:'Fictional client',expectedDays:[1,2,3,4,5,6,7]}]);
   if(url.pathname==='/api/myday/markers')return send({day:new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),notes:[]});
   return send({error:'Unavailable in this synthetic check'},401);
  });
  const locked=async()=>{
   await page.waitForLoadState('networkidle');
   await page.getByRole('heading',{name:'Staff PIN required',exact:true}).waitFor();
   assert.equal(await page.getByText('Fictional client',{exact:true}).count(),0);
  };
  await page.goto(base+'/register');await locked();assert.equal(unlocks,0);
  await page.getByLabel('Staff PIN',{exact:true}).fill('0000');await page.getByRole('button',{name:'Unlock register',exact:true}).click();await page.getByText('PIN not recognised',{exact:true}).waitFor();await locked();
  const unlock=async()=>{await page.getByLabel('Staff PIN',{exact:true}).fill('1234');await page.getByRole('button',{name:'Unlock register',exact:true}).click();await page.getByText('Fictional client',{exact:true}).waitFor()};
  await unlock();await page.reload();await locked();
  await unlock();await page.getByRole('button',{name:'Lock',exact:true}).click();await locked();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,checks:['My Day session does not bypass register PIN','client names hidden before unlock','invalid PIN stays locked','valid register PIN unlocks','reload requires PIN again','Lock hides client data'],pageErrors:errors}));
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
