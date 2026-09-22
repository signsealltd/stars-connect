export const requestFieldLabel=(key:string)=>({name:"Name",phone:"Phone number",address:"Address",emergencyContact:"Emergency contact",notifications:"Notifications",jobRole:"Job title",startDate:"Start date",endDate:"End date",description:"Description",before:"Before",after:"After"}[key]||key.replace(/([a-z])([A-Z])/g,"$1 $2").replaceAll("_"," ").replace(/^./,c=>c.toUpperCase()));
export function requestDetailRows(value:unknown,prefix=""):Array<{key:string;label:string;value:string}>{
 if(!value||typeof value!=="object"||Array.isArray(value))return [];
 return Object.entries(value).flatMap(([key,v])=>{
  if(["key","type","draft"].includes(key))return [];
  const path=prefix?prefix+"."+key:key;
  if(v&&typeof v==="object"&&!Array.isArray(v))return requestDetailRows(v,key==="profile"?prefix:path);
  const text=v===null||v===undefined||v===""?"Not provided":typeof v==="boolean"?(v?"Yes":"No"):Array.isArray(v)?v.map(item=>typeof item==="object"?requestDetailRows(item).map(row=>row.label+": "+row.value).join("; "):String(item)).join("\n"):String(v);
  return [{key:path,label:path.split(".").map(requestFieldLabel).join(" — "),value:text}];
 });
}
