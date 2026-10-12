import {describe,it,expect} from "vitest";
import {matchIhascoEmail,ihascoQualificationIssue,onlineCourseAllowed,qualifiesIhasco,renewalDates,syncRange,checkpointMayAdvance} from "./ihasco-rules";
import {trainingRecordMatchesCourse} from "./training-catalogue";
import type {IhResult} from "./ihasco-client";
const user={id:"1",email:"Person@example.test",first_name:"Same",last_name:"Name"};
const staff=[{id:"staff",email:"person@example.test"}];
describe("iHasco mapping and compliance",()=>{
  it("matches only unique exact emails, never names",()=>{
    expect(matchIhascoEmail(user,[user],staff)).toEqual({staffId:"staff",state:"EXACT_EMAIL"});
    expect(matchIhascoEmail({...user,email:null},[user],staff).state).toBe("MISSING_EMAIL");
    expect(matchIhascoEmail({...user,email:"different@example.test"},[{...user,email:"different@example.test"}],staff).staffId).toBeNull();
    expect(matchIhascoEmail(user,[user,{...user,id:"2"}],staff).state).toBe("AMBIGUOUS_EMAIL");
    expect(matchIhascoEmail(user,[user],[...staff,{...staff[0],id:"other"}]).state).toBe("AMBIGUOUS_EMAIL");
  });
  it("does not use online training to satisfy practical or full-package requirements",()=>{
    for(const name of ["Medication Practical Competency","Buccal Midazolam Administration & Competency","First Aid at Work","Oliver McGowan Mandatory Training - Part 2","Oliver McGowan Tier 2 Full Package"])expect(onlineCourseAllowed({name,evidenceKind:"COURSE"})).toBe(false);
    expect(onlineCourseAllowed({name:"Fire Safety",evidenceKind:"THEORY"})).toBe(true);
    expect(onlineCourseAllowed({name:"Any name",evidenceKind:"PRACTICAL"})).toBe(false);
    expect(trainingRecordMatchesCourse({courseId:"course",courseName:"Fire",externalResult:{qualifies:false}},{id:"course",name:"Fire",evidenceKind:"THEORY"})).toBe(false);
    expect(trainingRecordMatchesCourse({courseId:"course",courseName:"Online module",externalResult:{qualifies:true}},{id:"course",name:"Oliver McGowan Mandatory Training - Part 2",evidenceKind:"COURSE"})).toBe(false);
  });
  it("credits only confirmed metadata statuses, completed dates and qualifying scores",()=>{
    const codes=[{code:900,description:"Passed"},{code:901,description:"Failed"}],approved=[codes[0]];
    const result={status_code:900,completed_at:"2020-01-01 12:00:00",pass_mark:80,test_score:85} as IhResult;
    expect(qualifiesIhasco(result,codes,approved)).toBe(true);
    expect(qualifiesIhasco({...result,status_code:901},codes,approved)).toBe(false);
    expect(qualifiesIhasco({...result,status_code:150},codes,approved)).toBe(false);
    expect(qualifiesIhasco({...result,test_score:79},codes,approved)).toBe(false);
    expect(qualifiesIhasco({...result,completed_at:null},codes,approved)).toBe(true); // Preserve provider success; matrix requires a date review.
    expect(qualifiesIhasco(result,[{code:900,description:"Meaning changed"}],approved)).toBe(false);
  });
  it("retains provider expiry separately and uses the earlier configured renewal",()=>{
    const completed=new Date("2024-02-29Z"),provider=new Date("2026-01-01Z");
    const dates=renewalDates(completed,provider,12);
    expect(dates.stars?.toISOString().slice(0,10)).toBe("2025-02-28");expect(dates.applicable).toEqual(dates.stars);expect(provider.toISOString().slice(0,10)).toBe("2026-01-01");
  });
  it("includes historic results, overlaps recent dates and periodically fully reconciles",()=>{
    const now=new Date("2026-10-12Z");expect(syncRange(null,null,now).full).toBe(true);
    const recent=syncRange(new Date("2026-10-11Z"),new Date("2026-10-01Z"),now);expect(recent.full).toBe(false);expect(recent.path).toContain("completion_date_from=2026-10-04");expect(recent.path).toContain("include_archived=1");expect(recent.path).not.toContain("certificate_link");
    expect(syncRange(new Date("2026-10-11Z"),new Date("2026-09-01Z"),now).full).toBe(true);
    expect(checkpointMayAdvance({unmatched:1,failed:0})).toBe(false);expect(checkpointMayAdvance({unmatched:0,failed:1})).toBe(false);
  });
});

it("explains why a matched Test complete result is not credited",()=>{
 const codes=[{code:140,description:"Test complete"}],result={status_code:140,completed_at:"2026-10-09 17:15:17",test_score:100,pass_mark:80} as IhResult;
 expect(ihascoQualificationIssue(result,codes,[])).toContain("has not been confirmed");
 expect(ihascoQualificationIssue(result,codes,codes)).toBeNull();
 expect(ihascoQualificationIssue({...result,pass_mark:null},codes,codes)).toContain("did not supply a result pass mark");
 expect(ihascoQualificationIssue({...result,test_score:70},codes,codes)).toContain("below the supplied pass mark");
 expect(ihascoQualificationIssue({...result,test_score:null},codes,codes)).toContain("no test score");
});
