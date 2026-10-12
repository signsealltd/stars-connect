import {expect,it} from "vitest";
import {trainingProgress,trainingCsv} from "./training-presentation";
it("counts only required courses and treats due-soon training as still in date",()=>{
 expect(trainingProgress([{requirement:"REQUIRED",state:"CURRENT"},{requirement:"REQUIRED",state:"DUE_SOON"},{requirement:"REQUIRED",state:"EXPIRED"},{requirement:"REQUIRED",state:"MISSING"},{requirement:"OPTIONAL",state:"CURRENT"},{requirement:"CONDITIONAL",state:"MISSING"}])).toEqual({total:4,current:2,expired:1,missing:1,due:1,percent:50});
 expect(trainingProgress([])).toMatchObject({total:0,current:0,percent:0});
});
it("escapes CSV cells and prevents user-entered spreadsheet formulas",()=>{
 const csv=trainingCsv([["Smith, A",'Course "A"',"=HYPERLINK(1)"," +SUM(1)",null]]);
 expect(csv).toContain('"Smith, A"');expect(csv).toContain('"Course ""A"""');expect(csv).toContain('"\'=HYPERLINK(1)"');expect(csv).toContain('"\' +SUM(1)"');
});
