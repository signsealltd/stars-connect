import {fromZonedTime} from "date-fns-tz";

const DAY = 86400000;
export const dateKey = (date: Date) => date.toISOString().slice(0, 10);
export const shiftDate = (key: string, days: number) => dateKey(new Date(Date.parse(key) + days * DAY));
export function leaveYear(today: string, month = 1, day = 1) {
  const suffix = `-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  let year = Number(today.slice(0,4));
  if (today < `${year}${suffix}`) year--;
  return {start: `${year}${suffix}`, end: shiftDate(`${year+1}${suffix}`, -1)};
}
export type AbsenceForSummary = {id:string;type:string;startDate:string;endDate:string;startTime?:string|null;endTime?:string|null;bradfordExcluded?:boolean;approvalStatus:string};
export type WorkDay = {date:string;intervals:Array<[number,number]>};
function union(intervals:Array<[number,number]>) {
  const merged:Array<[number,number]> = [];
  for(const [start,end] of intervals.filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0])) {
    const previous = merged.at(-1);
    if(previous && start<=previous[1]) previous[1]=Math.max(previous[1],end);
    else merged.push([start,end]);
  }
  return merged;
}
const duration=(intervals:Array<[number,number]>)=>union(intervals).reduce((n,[a,b])=>n+b-a,0);
export function absenceSummary(input:{today:string;year:{start:string;end:string};absences:AbsenceForSummary[];workDays:WorkDay[];knownDate:(date:string)=>boolean;employmentStart:string;employmentEnd?:string|null;entitlementDays:number|null;carryOverDays:number}) {
  const work = new Map(input.workDays.map(d=>[d.date,union(d.intervals)]));
  const approved=input.absences.filter(a=>a.approvalStatus==="APPROVED");
  const employed=(day:string)=>day>=input.employmentStart&&(!input.employmentEnd||day<=input.employmentEnd);
  function measure(records:AbsenceForSummary[],start:string,end:string) {
    let days=0;const unknown=new Set<string>();
    for(let day=start;day<=end;day=shiftDate(day,1)) {
      if(!employed(day))continue;
      const active=records.filter(a=>a.startDate<=day&&a.endDate>=day);
      if(!active.length)continue;
      if(!input.knownDate(day)){unknown.add(day);continue;}
      const shifts=work.get(day)||[],total=duration(shifts);
      if(!total)continue;
      const covered=active.flatMap(a=>{
        if(!a.startTime||!a.endTime)return shifts;
        const from=+fromZonedTime(`${day}T${a.startTime}:00`,"Europe/London"),to=+fromZonedTime(`${day}T${a.endTime}:00`,"Europe/London");
        return shifts.map(([s,e])=>[Math.max(s,from),Math.min(e,to)] as [number,number]);
      });
      days+=Math.min(1,duration(covered)/total);
    }
    return {days:Math.round(days*100)/100,unknownDates:[...unknown]};
  }
  const holiday=approved.filter(a=>a.type==="ANNUAL_LEAVE");
  const taken=measure(holiday,input.year.start,input.today<input.year.end?input.today:input.year.end);
  const booked=measure(holiday,input.today>=input.year.start?shiftDate(input.today,1):input.year.start,input.year.end);
  const bradfordStart=shiftDate(input.today,-363);
  const sickness=approved.filter(a=>a.type==="SICKNESS"&&!a.bradfordExcluded&&a.startDate<=input.today&&a.endDate>=bradfordStart).sort((a,b)=>a.startDate.localeCompare(b.startDate));
  const sickDays=measure(sickness,bradfordStart,input.today);
  const spells:Array<{start:string;end:string}>=[];
  for(const record of sickness) {
    const start=record.startDate<bradfordStart?bradfordStart:record.startDate,end=record.endDate>input.today?input.today:record.endDate;
    if(measure([record],start,end).days===0)continue;
    const previous=spells.at(-1);
    let joined=!!previous;
    if(previous)for(let day=shiftDate(previous.end,1);day<start;day=shiftDate(day,1)) {
      if(!input.knownDate(day)||(work.get(day)?.length||0)>0){joined=false;break;}
    }
    if(previous&&joined)previous.end=previous.end>end?previous.end:end;
    else spells.push({start,end});
  }
  const holidayKnown=!taken.unknownDates.length&&!booked.unknownDates.length;
  return {year:input.year,taken,booked,entitlementDays:input.entitlementDays,carryOverDays:input.carryOverDays,
    remainingDays:input.entitlementDays===null||!holidayKnown?null:Math.round((input.entitlementDays+input.carryOverDays-taken.days-booked.days)*100)/100,
    bradford:{start:bradfordStart,end:input.today,spells:spells.length,days:sickDays.days,score:sickDays.unknownDates.length?null:Math.round(spells.length**2*sickDays.days*100)/100,unknownDates:sickDays.unknownDates,
      excludedRecords:approved.filter(a=>a.type==="SICKNESS"&&a.bradfordExcluded&&a.startDate<=input.today&&a.endDate>=bradfordStart).length}};
}
