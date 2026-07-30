import { readFile } from "fs/promises";
import path from "path";

export async function loadInvoiceLogo(value?: string) {
  if (value?.startsWith("data:image/jpeg;base64,")) {
    return Buffer.from(value.slice("data:image/jpeg;base64,".length), "base64");
  }
  return readFile(path.join(process.cwd(), "public", "branding", "stars-logo-pdf.jpg"));
}

export function safeDocumentName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 70) || "Service-User";
}
