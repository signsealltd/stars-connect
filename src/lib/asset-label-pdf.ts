import QRCode from 'qrcode';
import {assetNumber,assetPublicUrl,labelGeometry,type LabelProfile} from './asset-domain';
const pt=(mm:number)=>mm*72/25.4;
const esc=(s:string)=>s.replace(/[–—]/g,'-').replace(/[^\x20-\x7e]/g,'?').replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)');
export type LabelAsset={assetSequence:number;qrToken:string;name:string;location:string|null};
export function labelPdf(assets:LabelAsset[],profile:LabelProfile,start=0,calibration=false){const g=labelGeometry(profile,assets.length,start),pages:string[][]=[];
 g.positions.forEach((pos,i)=>{const lines=pages[pos.page]||(pages[pos.page]=[]),a=assets[i],x=pt(pos.x+profile.margin+(profile.kind==='ROLL'?profile.offsetX:0)),top=pt(g.pageHeight-pos.y-profile.margin-(profile.kind==='ROLL'?profile.offsetY:0)),size=pt(profile.qrSize),qr=QRCode.create(assetPublicUrl(a.qrToken),{errorCorrectionLevel:'M'}),modules=qr.modules.size,cell=size/(modules+8);if(profile.qrSize/(modules+8)<0.3)throw Error('QR modules are too small for this URL. Increase QR size.');
 lines.push('0 0 0 rg');for(let r=0;r<modules;r++)for(let c=0;c<modules;c++)if(qr.modules.get(r,c))lines.push(`${x+(c+4)*cell} ${top-(r+5)*cell} ${cell+0.005} ${cell+0.005} re f`);
 const textX=x+size+pt(2),width=pt(g.width-2*profile.margin-profile.qrSize-2),font=profile.fontSize,max=Math.floor(width/(font*.62));
 if(assetNumber(a.assetSequence).length>max)throw Error('Asset number does not fit: reduce text size or use a wider label.');
 const wrap=(text:string,n:number)=>{const words=text.replace(/\s+/g,' ').trim().split(' '),out:string[]=[];let line='';for(const word of words){if((line+' '+word).trim().length<=max)line=(line+' '+word).trim();else{if(line)out.push(line);line=word;while(line.length>max){out.push(line.slice(0,max));line=line.slice(max);}}}if(line)out.push(line);if(out.length>n)out[n-1]=out[n-1].slice(0,Math.max(0,max-3))+'...';return out.slice(0,n);};
 const text=[...(profile.showBrand?['STARS Connect']:[]),assetNumber(a.assetSequence),...(profile.showName?wrap(a.name,2):[]),...(profile.showLocation?wrap(a.location||'',1):[])];text.forEach((t,j)=>lines.push(`BT /F1 ${font} Tf ${textX} ${top-font*(1+j*1.18)} Td (${esc(t)}) Tj ET`));
 if(calibration){lines.push('0.65 0.65 0.65 RG 0.25 w',`${pt(pos.x)} ${pt(g.pageHeight-pos.y-g.height)} ${pt(g.width)} ${pt(g.height)} re S`);}
 });
 for(let i=0;i<pages.length;i++)pages[i]??=[];
 const fontRef=3+pages.length*2,objects=[`<< /Type /Catalog /Pages 2 0 R >>`,`<< /Type /Pages /Kids [${pages.map((_,i)=>`${3+i*2} 0 R`).join(' ')}] /Count ${pages.length} >>`];pages.forEach((page,i)=>{const content=page.join('\n');objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pt(g.pageWidth)} ${pt(g.pageHeight)}] /Resources << /Font << /F1 ${fontRef} 0 R >> >> /Contents ${4+i*2} 0 R >>`,`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`)});objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');let pdf='%PDF-1.4\n';const offsets=[0];objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(x=>String(x).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer << /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(pdf);
}
