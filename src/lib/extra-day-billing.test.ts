import {expect,it} from "vitest";
import {extraDayAmounts,invoiceBaseAmounts} from "./extra-day-billing";
it("uses the dated day rate and refuses missing or non-day rates",()=>{
 const base={id:"old",active:true,attendanceDependency:"FUNDED",unitType:"DAY",activeFrom:new Date("2026-01-01"),activeTo:null,applicableWeekdays:[],rate:100,vatRate:20};
 expect(extraDayAmounts([base,{...base,id:"new",activeFrom:new Date("2026-10-01"),rate:110}],new Date("2026-10-03")).amounts).toMatchObject({quantity:1,grossAmount:132});
 expect(()=>extraDayAmounts([],new Date())).toThrow();
 expect(()=>extraDayAmounts([{...base,unitType:"HOUR"}],new Date())).toThrow();
});
it("subtracts extra charges exactly once from a reviewed invoice total",()=>{
 expect(invoiceBaseAmounts(1320,11,120,1,100,20)).toMatchObject({quantity:10,grossAmount:1200});
 expect(invoiceBaseAmounts(120,1,120,1,100,20)).toMatchObject({quantity:0,grossAmount:0});
 expect(()=>invoiceBaseAmounts(100,1,120,1,100,20)).toThrow();
 expect(()=>invoiceBaseAmounts(1400,11,120,1,100,20)).toThrow();
});
