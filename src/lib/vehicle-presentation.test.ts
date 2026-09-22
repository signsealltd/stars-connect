import {it,expect} from "vitest";
import {normaliseMileage,formatVehicleDate} from "./vehicle-presentation";
it("normalises mileage without introducing a zero into empty input",()=>{expect(normaliseMileage("")).toBe("");expect(normaliseMileage("0115000")).toBe("115000");expect(normaliseMileage("115,000 miles")).toBe("115000");expect(normaliseMileage("000")).toBe("0");expect(normaliseMileage("0")).toBe("0");expect(normaliseMileage("abc")).toBe("")});
it("shows a readable UK date using the UK calendar day",()=>{expect(formatVehicleDate("2026-09-22T23:30:00Z")).toBe("23 September 2026")});
