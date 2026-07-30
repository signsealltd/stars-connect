export type InvoicePdfRow = {
  date: string;
  service?: string;
  days: string;
  rate: string;
  net: string;
  vat: string;
  total: string;
};

export type InvoicePdfInput = {
  logoJpeg: Buffer;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  periodLabel: string;
  supplierName: string;
  supplierAddress: string[];
  companyNumber?: string;
  vatNumber?: string;
  payerName: string;
  payerAddress: string[];
  studentName: string;
  studentReference: string;
  rows: InvoicePdfRow[];
  attendanceDays: string;
  dayRate: string;
  netTotal: string;
  vatTotal: string;
  grossTotal: string;
  paymentTerms: string;
  bankDetails: string[];
  remittanceInstructions: string[];
  approvedAt: string;
  generatedAt: string;
};

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const PURPLE = "0.32 0.13 0.36";
const PURPLE_SOFT = "0.97 0.95 0.98";
const INK = "0.13 0.11 0.14";
const MUTED = "0.40 0.37 0.41";
const BORDER = "0.87 0.84 0.88";

function esc(value: string) {
  return value
    .replace(/[–—]/g, "-")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/£/g, "GBP ")
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function text(value: string, x: number, y: number, size = 9, bold = false, colour = INK) {
  return `BT /${bold ? "F2" : "F1"} ${size} Tf ${colour} rg ${x} ${y} Td (${esc(value)}) Tj ET`;
}

function rect(x: number, y: number, width: number, height: number, fill: string, stroke?: string) {
  return `${fill} rg ${stroke || fill} RG ${x} ${y} ${width} ${height} re B`;
}

function line(x1: number, y1: number, x2: number, y2: number, colour = BORDER) {
  return `${colour} RG 0.6 w ${x1} ${y1} m ${x2} ${y2} l S`;
}

function fit(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, Math.max(1, max - 3))}...`;
}

function addressBlock(lines: string[], x: number, y: number) {
  return lines.filter(Boolean).slice(0, 5).map((value, index) => text(fit(value, 46), x, y - index * 13, 8));
}

function pageHeader(input: InvoicePdfInput, page: number) {
  const commands = [
    rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "1 1 1"),
    "q 100 0 0 73 42 747 cm /Logo Do Q",
    rect(366, 758, 187, 64, PURPLE),
    text("INVOICE NUMBER", 382, 801, 7.5, true, "1 1 1"),
    text(input.invoiceNumber, 382, 779, 12, true, "1 1 1"),
    line(42, 735, 553, 735, PURPLE),
  ];
  if (page > 1) {
    commands.push(
      text(`${input.studentName} - attendance continued`, 42, 712, 14, true),
      text(`Invoice ${input.invoiceNumber}`, 390, 712, 8, false, MUTED),
    );
  }
  return commands;
}

function tableHeader(y: number, showVat: boolean) {
  return [
    rect(42, y - 4, 511, 24, PURPLE_SOFT, BORDER),
    text("ATTENDANCE DATE", 50, y + 5, 7, true, PURPLE),
    text("SERVICE", 149, y + 5, 7, true, PURPLE),
    text("DAYS", 260, y + 5, 7, true, PURPLE),
    text("DAY RATE", 306, y + 5, 7, true, PURPLE),
    text("NET", 374, y + 5, 7, true, PURPLE),
    ...(showVat ? [text("VAT", 433, y + 5, 7, true, PURPLE)] : []),
    text("TOTAL", 487, y + 5, 7, true, PURPLE),
  ];
}

function tableRow(row: InvoicePdfRow, y: number, alternate: boolean, showVat: boolean) {
  const commands = [];
  if (alternate) commands.push(rect(42, y - 17, 511, 26, "0.985 0.98 0.99"));
  commands.push(
    text(row.date, 50, y - 1, 7.5),
    text(fit(row.service || "Attendance", 22), 149, y - 1, 7.5, true),
    text(row.days, 260, y - 1, 7.5),
    text(row.rate, 306, y - 1, 7.5),
    text(row.net, 374, y - 1, 7.5),
    ...(showVat ? [text(row.vat, 433, y - 1, 7.5)] : []),
    text(row.total, 487, y - 1, 7.5, true),
    line(42, y - 17, 553, y - 17),
  );
  return commands;
}

export function invoicePdf(input: InvoicePdfInput) {
  const showVat = Boolean(input.vatNumber?.trim()) || !/GBP\s+0(?:\.00)?$/.test(input.vatTotal.trim());
  const rows = input.rows.length ? input.rows : [{ date: "-", service: "Attendance", days: "0", rate: "GBP 0.00", net: "GBP 0.00", vat: "GBP 0.00", total: "GBP 0.00" }];
  const firstPageRows = 10;
  const continuedRows = 20;
  const pageRows = [rows.slice(0, firstPageRows)];
  for (let index = firstPageRows; index < rows.length; index += continuedRows) pageRows.push(rows.slice(index, index + continuedRows));

  const pageCount = pageRows.length;
  const regularRef = 3 + pageCount * 2;
  const boldRef = regularRef + 1;
  const logoRef = boldRef + 1;
  const pageRefs = pageRows.map((_, index) => 3 + index * 2);
  const objects: Array<string | Buffer> = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageRefs.map(ref => `${ref} 0 R`).join(" ")}] /Count ${pageCount} >>`,
  ];

  pageRows.forEach((page, pageIndex) => {
    const commands = pageHeader(input, pageIndex + 1);
    let tableY = 674;
    if (pageIndex === 0) {
      commands.push(
        text("OFFICIAL INVOICE", 42, 708, 8, true, PURPLE),
        text("Supplier", 42, 684, 8, true, PURPLE),
        text(input.supplierName, 42, 667, 10, true),
        ...addressBlock(input.supplierAddress, 42, 651),
        text("Billed to", 318, 684, 8, true, PURPLE),
        text(input.payerName, 318, 667, 10, true),
        ...addressBlock(input.payerAddress, 318, 651),
        text(`Invoice date: ${input.invoiceDate}`, 318, 586, 8),
        text(`Payment due: ${input.dueDate}`, 318, 571, 8, true),
        ...(input.companyNumber ? [text(`Company number: ${input.companyNumber}`, 42, 586, 8)] : []),
        ...(showVat && input.vatNumber ? [text(`VAT number: ${input.vatNumber}`, 42, 571, 8)] : []),
        rect(42, 502, 511, 52, PURPLE_SOFT, BORDER),
        text("SERVICE USER", 54, 537, 6.5, true, MUTED),
        text(input.studentName, 54, 518, 11, true, PURPLE),
        text("REFERENCE", 258, 537, 6.5, true, MUTED),
        text(input.studentReference, 258, 518, 10, true),
        text("BILLING PERIOD", 392, 537, 6.5, true, MUTED),
        text(input.periodLabel, 392, 518, 8.5, true),
      );
      const summary = [
        ["ATTENDANCE DAYS", input.attendanceDays],
        ["DAY RATE", input.dayRate],
        ["NET", input.netTotal],
        ...(showVat ? [["VAT", input.vatTotal]] : []),
        ["INVOICE TOTAL", input.grossTotal],
      ];
      summary.forEach((item, index) => {
        const width = 511 / summary.length;
        const x = 42 + index * width;
        const total = index === summary.length - 1;
        commands.push(rect(x, 438, width - 7, 48, total ? PURPLE : PURPLE_SOFT, total ? PURPLE : BORDER));
        commands.push(text(item[0], x + 8, 469, 6.1, true, total ? "1 1 1" : MUTED));
        commands.push(text(item[1], x + 8, 450, 10, true, total ? "1 1 1" : PURPLE));
      });
      commands.push(text("ATTENDANCE BREAKDOWN", 42, 414, 9, true, PURPLE));
      tableY = 386;
    }
    commands.push(...tableHeader(tableY, showVat));
    page.forEach((row, index) => commands.push(...tableRow(row, tableY - 27 - index * 26, index % 2 === 1, showVat)));

    if (pageIndex === pageCount - 1) {
      const detailsY = Math.max(78, tableY - 44 - page.length * 26 - 138);
      const bankLines = input.bankDetails.filter(Boolean).slice(0, 5);
      const remittanceLines = input.remittanceInstructions.filter(Boolean).slice(0, 3);
      commands.push(
        rect(42, detailsY, 511, 122, PURPLE_SOFT, BORDER),
        text("PAYMENT AND DOCUMENT DETAILS", 54, detailsY + 101, 8, true, PURPLE),
        text("PAYMENT TERMS", 54, detailsY + 82, 6.5, true, MUTED),
        text(fit(input.paymentTerms, 45), 54, detailsY + 66, 8),
        text("REMITTANCE", 54, detailsY + 45, 6.5, true, MUTED),
        ...remittanceLines.map((value, index) => text(fit(value, 45), 54, detailsY + 29 - index * 13, 7.5)),
        text("PAYMENT DETAILS", 305, detailsY + 82, 6.5, true, MUTED),
        ...bankLines.map((value, index) => text(fit(value, 45), 305, detailsY + 66 - index * 13, 7.5)),
      );
    }
    commands.push(
      line(42, 55, 553, 55),
      ...(pageIndex === pageCount - 1 ? [
        text(`Approved: ${input.approvedAt}`, 42, 39, 7, false, MUTED),
        text(`Generated: ${input.generatedAt}`, 280, 39, 7, false, MUTED),
      ] : []),
      text("Generated securely by STARS Connect", 42, 21, 7, false, MUTED),
      text(`Page ${pageIndex + 1} of ${pageCount}`, 503, 21, 7, false, MUTED),
    );

    const body = commands.join("\n");
    const pageRef = 3 + pageIndex * 2;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${regularRef} 0 R /F2 ${boldRef} 0 R >> /XObject << /Logo ${logoRef} 0 R >> >> /Contents ${pageRef + 1} 0 R >>`,
      `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`,
    );
  });

  objects.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width 260 /Height 189 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${input.logoJpeg.length} >>\nstream\n`),
      input.logoJpeg,
      Buffer.from("\nendstream"),
    ]),
  );

  let pdf = Buffer.from("%PDF-1.4\n", "latin1");
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf = Buffer.concat([pdf, Buffer.from(`${index + 1} 0 obj\n`, "latin1"), Buffer.isBuffer(object) ? object : Buffer.from(object, "latin1"), Buffer.from("\nendobj\n", "latin1")]);
  });
  const xref = pdf.length;
  const trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.concat([pdf, Buffer.from(trailer, "latin1")]);
}
