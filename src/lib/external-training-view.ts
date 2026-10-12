import {renewalDates} from "./ihasco-rules";

export const externalTrainingSelect={qualifies:true,score:true,passMark:true,attempts:true,statusLabel:true,providerExpiryDate:true,starsExpiryDate:true,certificateState:true,certificateError:true,completedAt:true} as const;
export function externalTrainingView<T extends {completedDate:Date;expiryDate:Date|null;course?:{renewalMonths:number|null}|null;externalResult?:{completedAt:Date|null;providerExpiryDate:Date|null;starsExpiryDate:Date|null;qualifies:boolean;score:number|null;passMark:number|null;attempts:number|null;statusLabel:string;certificateState:string;certificateError:string|null}|null}>(row:T){
  if(!row.externalResult)return row;
  const renewal=renewalDates(row.externalResult.completedAt,row.externalResult.providerExpiryDate,row.course?.renewalMonths??null);
  return {...row,expiryDate:renewal.applicable,externalResult:{...row.externalResult,starsExpiryDate:renewal.stars}};
}
