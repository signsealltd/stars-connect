import {renewalDates} from "./ihasco-rules";
import {readPolicy} from "./training-policy";

export const externalTrainingSelect={qualifies:true,score:true,passMark:true,attempts:true,statusLabel:true,providerExpiryDate:true,starsExpiryDate:true,certificateState:true,certificateError:true,completedAt:true} as const;
export function externalTrainingView<T extends {completedDate:Date;expiryDate:Date|null;course?:{renewalMonths:number|null;policy?:unknown}|null;externalResult?:{completedAt:Date|null;providerExpiryDate:Date|null;starsExpiryDate:Date|null;qualifies:boolean;score:number|null;passMark:number|null;attempts:number|null;statusLabel:string;certificateState:string;certificateError:string|null}|null}>(row:T){
  if(!row.externalResult){
    const policy=readPolicy(row.course?.policy);
    if(!policy.version)return row;
    const renewal=renewalDates(row.completedDate,row.expiryDate,policy.renewalKind==="ONE_OFF"||policy.renewalKind==="ON_PLAN_CHANGE"?null:row.course?.renewalMonths??null);
    return {...row,expiryDate:renewal.applicable};
  }
  const renewal=renewalDates(row.externalResult.completedAt,row.externalResult.providerExpiryDate,row.course?.renewalMonths??null);
  return {...row,expiryDate:renewal.applicable,externalResult:{...row.externalResult,starsExpiryDate:renewal.stars}};
}
