/** Current occupancy is separate from whether the client attended earlier today. */
export type ClientPresence = {status:string;departureTime?:Date|string|null};
export function clientIsOnSite(row:ClientPresence){return (row.status==="PRESENT"||row.status==="LATE")&&!row.departureTime}
/** Database equivalent of clientIsOnSite, shared by live attendance queries. */
export const clientOnSiteWhere={status:{in:["PRESENT","LATE"] as Array<"PRESENT"|"LATE">},departureTime:null};
