type TimesheetRow = {
  date: string;
  entry: string;
  details: string;
  hours: string;
  notes: string;
};

export type PayrollTimesheetPdfInput = {
  logoJpeg: Buffer;
  employeeName: string;
  payrollNumber: string;
  periodLabel: string;
  documentVersion: number;
  hourlyRate: string;
  estimatedGrossPay: string;
  summary: Array<{ label: string; value: string }>;
  rows: TimesheetRow[];
  exceptionStatus: string;
  exceptionCount: number;
  reviewedBy: string;
  reviewedAt: string;
  approvedBy: string;
  approvedAt: string;
  generatedBy: string;
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
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
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
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(1, max - 3))}...`;
}

function pageHeader(input: PayrollTimesheetPdfInput, page: number, pages: number) {
  const commands = [
    rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, "1 1 1"),
    "q 100 0 0 73 42 747 cm /Logo Do Q",
    rect(376, 764, 177, 58, PURPLE),
    text("PAY PERIOD", 392, 801, 8, true, "1 1 1"),
    text(input.periodLabel, 392, 779, 12, true, "1 1 1"),
    line(42, 735, 553, 735, PURPLE),
  ];
  if (page > 1) {
    commands.push(
      text(`${input.employeeName} - timesheet continued`, 42, 712, 14, true),
      text(`Page ${page} of ${pages}`, 487, 712, 8, false, MUTED),
    );
  }
  return commands;
}

function tableHeader(y: number) {
  return [
    rect(42, y - 4, 511, 24, PURPLE_SOFT, BORDER),
    text("DATE", 50, y + 5, 7, true, PURPLE),
    text("ENTRY", 112, y + 5, 7, true, PURPLE),
    text("TIME / DETAILS", 196, y + 5, 7, true, PURPLE),
    text("HOURS", 352, y + 5, 7, true, PURPLE),
    text("CORRECTION / NOTE", 405, y + 5, 7, true, PURPLE),
  ];
}

function tableRow(row: TimesheetRow, y: number, alternate: boolean) {
  const commands = [];
  if (alternate) commands.push(rect(42, y - 17, 511, 26, "0.985 0.98 0.99"));
  commands.push(
    text(fit(row.date, 11), 50, y - 1, 7.5),
    text(fit(row.entry, 16), 112, y - 1, 7.5, true),
    text(fit(row.details, 29), 196, y - 1, 7.5),
    text(fit(row.hours, 8), 352, y - 1, 7.5, true),
    text(fit(row.notes, 28), 405, y - 1, 7.2, false, MUTED),
    line(42, y - 17, 553, y - 17),
  );
  return commands;
}

export function payrollTimesheetPdf(input: PayrollTimesheetPdfInput) {
  const rows = input.rows.length
    ? input.rows
    : [{ date: "-", entry: "No entries", details: "No payable activity recorded", hours: "0.00", notes: "-" }];
  const firstPageRows = 10;
  const continuedRows = 20;
  const pageRows: TimesheetRow[][] = [rows.slice(0, firstPageRows)];
  for (let index = firstPageRows; index < rows.length; index += continuedRows) {
    pageRows.push(rows.slice(index, index + continuedRows));
  }

  const pageCount = pageRows.length;
  const fontRegularRef = 3 + pageCount * 2;
  const fontBoldRef = fontRegularRef + 1;
  const logoRef = fontBoldRef + 1;
  const pageRefs = pageRows.map((_, index) => 3 + index * 2);
  const objects: Array<string | Buffer> = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${pageRefs.map(ref => `${ref} 0 R`).join(" ")}] /Count ${pageCount} >>`,
  ];

  pageRows.forEach((page, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const commands = pageHeader(input, pageNumber, pageCount);
    let tableY: number;
    if (pageIndex === 0) {
      commands.push(
        text("EMPLOYEE TIMESHEET", 42, 704, 8, true, PURPLE),
        text(input.employeeName, 42, 675, 23, true),
        text(`Payroll number: ${input.payrollNumber}`, 42, 655, 9, false, MUTED),
        text(`Document version: ${input.documentVersion}`, 438, 655, 8, false, MUTED),
      );
      const summary = [
        ...input.summary,
        { label: "Hourly rate", value: input.hourlyRate },
        { label: "Estimated gross", value: input.estimatedGrossPay },
      ];
      summary.slice(0, 10).forEach((item, index) => {
        const col = index % 5;
        const row = Math.floor(index / 5);
        const x = 42 + col * 103;
        const y = 596 - row * 58;
        commands.push(
          rect(x, y, 96, 48, PURPLE_SOFT, BORDER),
          text(fit(item.label.toUpperCase(), 18), x + 8, y + 31, 6.2, true, MUTED),
          text(item.value, x + 8, y + 12, 11, true, PURPLE),
        );
      });
      commands.push(text("DAILY BREAKDOWN", 42, 482, 10, true, PURPLE));
      tableY = 454;
    } else {
      tableY = 674;
    }
    commands.push(...tableHeader(tableY));
    page.forEach((row, index) => commands.push(...tableRow(row, tableY - 27 - index * 26, index % 2 === 1)));

    if (pageIndex === pageCount - 1) {
      const reviewY = Math.max(80, tableY - 44 - page.length * 26 - 112);
      commands.push(
        rect(42, reviewY, 511, 96, PURPLE_SOFT, BORDER),
        text("REVIEW AND APPROVAL", 54, reviewY + 76, 9, true, PURPLE),
        text(
          `Exceptions: ${input.exceptionStatus} (${input.exceptionCount})`,
          54,
          reviewY + 57,
          8.5,
          true,
        ),
        text(`Corrected / reviewed by: ${input.reviewedBy} - ${input.reviewedAt}`, 54, reviewY + 39, 8),
        text(`Approved by: ${input.approvedBy} - ${input.approvedAt}`, 54, reviewY + 23, 8),
        text(`Sheet generated by: ${input.generatedBy} - ${input.generatedAt}`, 54, reviewY + 7, 8),
      );
    }
    commands.push(
      line(42, 48, 553, 48),
      text("Generated securely by STARS Connect", 42, 29, 7.5, false, MUTED),
      text(`Page ${pageNumber} of ${pageCount}`, 503, 29, 7.5, false, MUTED),
    );

    const body = commands.join("\n");
    const pageRef = 3 + pageIndex * 2;
    const contentRef = pageRef + 1;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontRegularRef} 0 R /F2 ${fontBoldRef} 0 R >> /XObject << /Logo ${logoRef} 0 R >> >> /Contents ${contentRef} 0 R >>`,
      `<< /Length ${Buffer.byteLength(body)} >>\nstream\n${body}\nendstream`,
    );
  });

  objects.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
    Buffer.concat([
      Buffer.from(
        `<< /Type /XObject /Subtype /Image /Width 260 /Height 189 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${input.logoJpeg.length} >>\nstream\n`,
      ),
      input.logoJpeg,
      Buffer.from("\nendstream"),
    ]),
  );

  let pdf = Buffer.from("%PDF-1.4\n", "latin1");
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    const content = Buffer.isBuffer(object) ? object : Buffer.from(object, "latin1");
    pdf = Buffer.concat([pdf, Buffer.from(`${index + 1} 0 obj\n`, "latin1"), content, Buffer.from("\nendobj\n", "latin1")]);
  });
  const xref = pdf.length;
  const trailer = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
    .slice(1)
    .map(offset => `${String(offset).padStart(10, "0")} 00000 n `)
    .join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.concat([pdf, Buffer.from(trailer, "latin1")]);
}
