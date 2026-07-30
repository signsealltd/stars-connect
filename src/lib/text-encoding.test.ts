import { readdirSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const suspiciousMojibake = /[\u00c2\u00c3]|\u00e2[\u0080-\u20ff]/u;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(file);
    return [".ts", ".tsx", ".css"].includes(extname(entry.name)) ? [file] : [];
  });
}

describe("source text encoding", () => {
  it("contains no common UTF-8 mojibake sequences", () => {
    const affected = sourceFiles("src").filter((file) => suspiciousMojibake.test(readFileSync(file, "utf8")));
    expect(affected).toEqual([]);
  });
});