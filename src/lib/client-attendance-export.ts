import { studentFullName } from "./student-name";

type Client = { id: string; firstName: string; lastName: string; displayName: string; internalReference: string | null };
const clean = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, " ");
const escape = (value: string) => clean(value).replace(/[\\()]/g, "\\$&");
const text = (value: string, x: number, y: number, size = 10, bold = false) => `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${escape(value)}) Tj ET`;
// Conservative character widths also keep long unbroken references inside their cells.
const wrap = (value: string, length: number) => clean(value).match(new RegExp(`.{1,${length}}`, "g")) || [""];

export function clientAttendanceExport(clients: Client[], generatedAt: string, organisation: string) {
  const rows = clients.map(client => ({ ...client, name: studentFullName(client) }))
    .sort((a, b) => a.name.localeCompare(b.name, "en-GB", { sensitivity: "base", numeric: true }) || a.id.localeCompare(b.id));
  const pages: string[][] = [];
  let page: string[] = [], y = 458;
  const startPage = () => {
    page = ["0.32 0.13 0.36 rg", text("STARS Connect", 36, 557, 18, true),
      "0.13 0.11 0.14 rg", text("Active clients - attendance count", 36, 530, 15, true),
      text(`${rows.length} active clients | ${generatedAt}`, 36, 510, 9),
      text("Period: ______________________________", 540, 530, 10),
      "0.96 0.94 0.97 rg 36 470 770 26 re f", "0.32 0.13 0.36 rg",
      text("Client name (A-Z)", 46, 479, 10, true), text("Reference", 396, 479, 10, true),
      text("Attendance count", 616, 479, 10, true), "0.13 0.11 0.14 rg"];
    y = 470;
  };
  startPage();
  for (const row of rows) {
    const names = wrap(row.name, 35), references = wrap(row.internalReference || "Not recorded", 21);
    const height = Math.max(34, Math.max(names.length, references.length) * 13 + 16);
    if (y - height < 58) { pages.push(page); startPage(); }
    page.push(`0.82 0.78 0.84 RG 0.5 w 36 ${y - height} 770 ${height} re S`,
      `386 ${y} m 386 ${y - height} l S 606 ${y} m 606 ${y - height} l S`);
    names.forEach((name, index) => page.push(text(name, 46, y - 20 - index * 13)));
    references.forEach((reference, index) => page.push(text(reference, 396, y - 20 - index * 13)));
    y -= height;
  }
  if (!rows.length) page.push(text("No active clients.", 46, 445));
  pages.push(page);
  const font = 3 + pages.length * 2;
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 2} 0 R`).join(" ")}] >>`];
  pages.forEach((commands, index) => {
    commands.push(text(organisation.slice(0, 90), 36, 30, 8), text(`Page ${index + 1} of ${pages.length}`, 735, 30, 8));
    const body = commands.join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 ${font} 0 R /F2 ${font + 1} 0 R >> >> /Contents ${4 + index * 2} 0 R >>`, `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`);
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
