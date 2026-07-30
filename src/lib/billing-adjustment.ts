export type BillingAdjustmentAmounts = {
  netAmount: number;
  vatRate: number;
  vatAmount: number;
  grossAmount: number;
};

function currency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateBillingAdjustment(netInput: unknown, vatRateInput: unknown): BillingAdjustmentAmounts {
  const netAmount = Number(netInput);
  const vatRate = Number(vatRateInput);
  if (!Number.isFinite(netAmount) || netAmount < 0) throw new Error("INVALID_NET_AMOUNT");
  if (!Number.isFinite(vatRate) || vatRate < 0 || vatRate > 100) throw new Error("INVALID_VAT_RATE");
  const roundedNet = currency(netAmount);
  const vatAmount = currency(roundedNet * vatRate / 100);
  return {
    netAmount: roundedNet,
    vatRate,
    vatAmount,
    grossAmount: currency(roundedNet + vatAmount),
  };
}
