import {describe,it,expect} from 'vitest';
import {assetNumber,assetPublicUrl,assetReturnPath,labelGeometry,labelProfileSchema,draftLabelProfile,l6009LabelProfile,testingState,operationalLabel} from './asset-domain';
import {publicAssetRecord,type PublicAssetInput} from './asset-public';
import {labelPdf} from './asset-label-pdf';
const asset={assetSequence:142,name:'Main light',qrToken:'38752b42-3775-4c99-8b9b-f140038f8e9c',category:'LIGHT',publicEnabled:true,publishedAt:new Date("2026-10-01"),publicLocation:'Reception',status:'OUT_OF_SERVICE',publicPhotoFileId:null,serialNumber:'SECRET',responsibleName:'Private person',notes:'Private narrative',details:{cost:99},inspections:[{completedDate:new Date('2026-10-12'),testType:'Function test',result:'FAIL',publicSummary:'Awaiting repair',notes:'Private fault',completedBy:'Private name'}],schedules:[{active:true,testType:'Function',nextDueDate:new Date('2026-11-12')}],documents:[{id:'private',active:true,title:'Private manual',publishedFileId:null},{id:'approved',active:true,title:'Public manual',publishedFileId:'approved-file'}]} as unknown as PublicAssetInput;
describe('Asset identity and public projection',()=>{
 it('keeps number and QR stable across edits and retirement',()=>{const before=assetPublicUrl(asset.qrToken,'https://stars.example');const updated={...asset,name:'Moved',location:'Office',status:'DECOMMISSIONED'};expect(assetPublicUrl(updated.qrToken,'https://stars.example')).toBe(before);expect(assetNumber(updated.assetSequence)).toBe('STR-000142');expect(assetNumber(1000000)).toBe('STR-1000000');});
 it('requires a configured HTTPS origin and never uses request hosts',()=>{expect(()=>assetPublicUrl('token','http://localhost')).toThrow();expect(()=>assetPublicUrl('token','https://user:password@example.test')).toThrow();expect(assetPublicUrl(asset.qrToken,'https://stars.example/base')).toBe('https://stars.example/assets/'+asset.qrToken);});
 it('only accepts internal asset return paths',()=>{for(const value of ['//evil.test','https://evil.test','/dashboard/../api/users','/dashboard/premises/assets/%2f%2fevil'])expect(assetReturnPath(value)).toBe('/dashboard');expect(assetReturnPath('/dashboard/premises/assets/'+asset.qrToken)).toContain(asset.qrToken);});
 it('strictly excludes private fields and unpublished files',()=>{const data=publicAssetRecord(asset,'Emergency lighting');expect(data?.number).toBe('STR-000142');expect(data?.timeline[0].summary).toBe('Awaiting repair');const text=JSON.stringify(data);for(const forbidden of ['Private','SECRET','cost','responsibleName','serialNumber','notes'])expect(text).not.toContain(forbidden);expect(data?.documents).toHaveLength(1);});
 it('returns no record while private and no imaginary history for a new asset',()=>{expect(publicAssetRecord({...asset,publicEnabled:false},'Light')).toBeNull();expect(publicAssetRecord({...asset,publishedAt:null},'Light')).toBeNull();const data=publicAssetRecord({...asset,inspections:[],schedules:[]},'Light');expect(data?.lastTest).toBeNull();expect(data?.nextTest).toBeNull();});
 it('keeps operational and testing status separate, including due today',()=>{expect(operationalLabel('OPERATIONAL')).toBe('In service');expect(testingState('2026-10-12','2026-10-13')).toBe('Overdue');expect(testingState('2026-10-13','2026-10-13')).toBe('Due soon');expect(testingState(null)).toBe('Not scheduled');});
});
describe('Physical label layouts',()=>{
 it('places a partial sheet across rows then starts a new page',()=>{const g=labelGeometry(draftLabelProfile,3,20);expect(g.positions.map(p=>p.page)).toEqual([0,1,1]);expect(g.positions[0].x).toBe(139);expect(g.positions[1]).toEqual({page:1,x:7,y:15});});
 it('rejects off-page, tiny, oversized, and invalid starting layouts',()=>{expect(()=>labelGeometry({...draftLabelProfile,left:30},1)).toThrow(/beyond/);expect(()=>labelGeometry({...draftLabelProfile,width:30},1)).toThrow(/fit/);expect(()=>labelGeometry(draftLabelProfile,1,21)).toThrow();expect(labelProfileSchema.safeParse({...draftLabelProfile,qrSize:5}).success).toBe(false);});
 it('supports custom roll sizes and orientation without assuming stock',()=>{const p={...draftLabelProfile,kind:'ROLL' as const,width:80,height:40,left:0,top:0,offsetX:1,offsetY:0};const g=labelGeometry(p,2);expect(g.pageWidth).toBe(80);expect(g.positions[1].page).toBe(1);expect(()=>labelGeometry({...p,offsetX:10},1)).toThrow(/offset/);});
 it('produces exact PDF media boxes with stable QR, independent of queue state',()=>{process.env.APP_URL='https://stars.example';const one={assetSequence:142,qrToken:asset.qrToken,name:'Main light',location:'Reception'};const pdf=labelPdf([one],draftLabelProfile,20).toString();expect(pdf).toContain('/MediaBox [0 0 595.2755905511812 841.8897637795276]');expect(pdf).toContain('(STR-000142)');expect(labelPdf([one],draftLabelProfile,20).toString()).toBe(pdf);});
});

describe('Avery L6009 stock',()=>{
 it('fits 48 labels at the official template spacing and continues a partial sheet',()=>{
  expect(labelProfileSchema.safeParse(l6009LabelProfile).success).toBe(true);
  const g=labelGeometry(l6009LabelProfile,49);
  expect(g.capacity).toBe(48);
  expect(g.width).toBeCloseTo(45.72,4);
  expect(g.height).toBeCloseTo(21.166667,4);
  expect(g.positions[0].x).toBeCloseTo(9.913056,4);
  expect(g.positions[0].y).toBeCloseTo(21.466528,4);
  expect(g.positions[47].x+g.width).toBeLessThan(210);
  expect(g.positions[47].y+g.height).toBeLessThan(297);
  expect(g.positions[48]).toEqual({...g.positions[0],page:1});
  expect(labelGeometry(l6009LabelProfile,2,47).positions).toEqual([g.positions[47],g.positions[48]]);
  expect(()=>labelGeometry(l6009LabelProfile,1,48)).toThrow();
 });
 it('prints full asset numbers on two A4 pages with the compact QR',()=>{
  process.env.APP_URL='https://stars.example';
  const rows=Array.from({length:49},(_,i)=>({assetSequence:i+142,qrToken:asset.qrToken,name:'Emergency light — main entrance',location:'Reception'}));
  const pdf=labelPdf(rows,l6009LabelProfile).toString();
  expect(pdf).toContain('/Count 2');
  expect(pdf).toContain('(STR-000142)');
  expect(pdf).toContain('(STR-000190)');
  expect(pdf.match(/\/Type \/Page\b/g)).toHaveLength(2);
 });
});
