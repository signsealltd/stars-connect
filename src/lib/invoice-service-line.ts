export function calculateInvoiceServiceLine(quantity: number, unitRate: number, vatRate: number) {
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000) throw new Error("INVALID_QUANTITY");
  if (!Number.isFinite(unitRate) || unitRate < 0) throw new Error("INVALID_UNIT_RATE");
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) throw new Error("INVALID_VAT_RATE");
  const netAmount = Math.round(quantity * unitRate * 100) / 100;
  const vatAmount = Math.round(netAmount * vatRate) / 100;
  return { netAmount, vatAmount, grossAmount: netAmount + vatAmount };
}
