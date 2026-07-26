export type AttendanceStatus="NOT_MARKED"|"PRESENT"|"ABSENT"|"OFFSITE"|"LATE"|"CANCELLED";
export type LocalClockEvent={id:string;staffId:string;staffName:string;type:"CLOCK_IN"|"CLOCK_OUT";deviceId:string;deviceTimestamp:string;photoStatus:"NOT_REQUIRED"|"CAPTURED"|"UNAVAILABLE"|"PENDING_UPLOAD";offlineRecorded:boolean};
export type LocalStudent={id:string;displayName:string;expectedDays:number[];profilePhotoUrl?:string};
export type LocalAttendance={id:string;studentId:string;date:string;status:AttendanceStatus;arrivalTime?:string;departureTime?:string;note?:string;deviceTimestamp:string;version:number};
export type LocalVisitorVisit={id:string;visitorId:string;referenceCode:string;fullName:string;company?:string;host:string;reasonLabel:string;otherReason?:string;vehicleRegistration?:string;expectedDurationMinutes?:number;signedInAt:string;signedOutAt?:string;emergencyIncluded:boolean};
export type PendingChange={id:string;operation:"CLOCK_EVENT"|"ATTENDANCE"|"ROLL_CALL_ENTRY"|"VISITOR_SIGN_IN"|"VISITOR_SIGN_OUT";payload:unknown;createdAt:string;attempts:number};
