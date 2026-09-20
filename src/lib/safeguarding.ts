export type AbsenceRecord={id:string;date:Date;status:string};
export type AbsencePolicy={mode:"ACCUMULATED"|"CONSECUTIVE";windowDays:number};
export function qualifyingAbsences(records:AbsenceRecord[],consumed:ReadonlySet<string>,policy:AbsencePolicy,now:Date) {
  const cutoff=policy.windowDays?new Date(now.getTime()-policy.windowDays*86400000):null;
  const sorted=records.filter(r=>r.date<=now&&(!cutoff||r.date>=cutoff)).sort((a,b)=>a.date.getTime()-b.date.getTime());
  let found:AbsenceRecord[]=[];
  for(const record of sorted){
    if(consumed.has(record.id)){if(policy.mode==="CONSECUTIVE")found=[];continue;}
    if(record.status==="ABSENT")found.push(record);
    else if(policy.mode==="CONSECUTIVE"&&["PRESENT","LATE","OFFSITE"].includes(record.status))found=[];
  }
  return found.length>=3?found:[];
}
