export const vehicleDay=(date:string|Date=new Date())=>new Intl.DateTimeFormat("sv-SE",{timeZone:"Europe/London"}).format(new Date(date));
export function checkCanBeAmended(check:{userId:string;vehicleId:string;checkDate:Date;clientStartedAt:Date},input:{vehicleId:string;clientStartedAt:string},userId:string,now=new Date()){
 if(check.userId!==userId||check.vehicleId!==input.vehicleId)throw Error("Only the person who submitted this check can amend it.");
 if(check.checkDate.toISOString().slice(0,10)!==vehicleDay(now))throw Error("Only today's checks can be amended. Start a new daily check.");
 if(check.clientStartedAt.toISOString()!==new Date(input.clientStartedAt).toISOString())throw Error("Keep the original check date when making an amendment.");
}
