import{describe,expect,it}from"vitest";import{roundNearest}from"./transport-settings";
describe("nearest interval payroll rounding",()=>{it("rounds 7 down",()=>expect(roundNearest(7)).toBe(0));it("rounds 8 up",()=>expect(roundNearest(8)).toBe(15));it("keeps exact intervals",()=>expect(roundNearest(30)).toBe(30))});
