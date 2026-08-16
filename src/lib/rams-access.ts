import type { Role } from "@prisma/client";
export const isRamsPilotRole=(role:Role)=>role==="DIRECTOR"||role==="ADMINISTRATOR";

