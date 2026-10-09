import {it,expect} from "vitest";
import {staffAbsenceLabel,requestedLeaveType} from "./staff-absence-types";
it("retains unpaid and compassionate categories when approving staff leave requests",()=>{
 expect(requestedLeaveType("UNPAID_LEAVE")).toBe("UNPAID_LEAVE");
 expect(requestedLeaveType("COMPASSIONATE_LEAVE")).toBe("COMPASSIONATE_LEAVE");
 expect(requestedLeaveType("ANNUAL_LEAVE")).toBe("ANNUAL_LEAVE");
 expect(staffAbsenceLabel("UNPAID_LEAVE")).toBe("Unpaid holiday");
 expect(staffAbsenceLabel("COMPASSIONATE_LEAVE")).toBe("Compassionate leave");
});
