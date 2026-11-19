import {describe,it,expect} from "vitest";
import {mydayPdf,mydayWrap,MyDayPdfOverflow} from "./myday-pdf";
const content={opening:"Maya chose the games table and invited a friend to join.",activities:"Maya watched the music session by choice and joined a game of dominoes.",enjoyment:"Maya communicated a rating of 8/10 for dominoes.",support:"We helped Maya choose between two activities."};
describe("one-page monthly PDF",()=>{
 it("emits a single A4 page and includes all reviewed text",()=>{const pdf=mydayPdf({name:"Maya Reed",month:"November 2026",content,logo:Buffer.from("fictional-jpeg")}).toString();expect(pdf).toContain("/MediaBox [0 0 595 842]");expect(pdf).toContain("/Count 1");expect(pdf).toContain(Buffer.from(content.opening,"latin1").toString("hex"));});
 it("blocks overflow instead of shrinking or dropping content",()=>{expect(()=>mydayPdf({name:"Maya Reed",month:"November 2026",content:{...content,activities:"A recorded observation. ".repeat(1000)},logo:Buffer.from("jpeg")})).toThrow(MyDayPdfOverflow);});
 it("wraps long unbroken words and rejects unsupported symbols explicitly",()=>{expect(mydayWrap("W".repeat(500)).length).toBeGreaterThan(1);expect(()=>mydayPdf({name:"Maya Reed",month:"November 2026",content:{...content,opening:"Unreviewed emoji 😄"},logo:Buffer.from("jpeg")})).toThrow("unsupported symbol");});
});
