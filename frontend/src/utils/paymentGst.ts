export type PaymentGstMode = 'NONE' | 'CGST_SGST' | 'IGST';

export interface ComputePaymentTotalsInput {
  gstMode: PaymentGstMode;
  amount?: number;
  taxableAmount?: number;
  cgstRate?: number;
  sgstRate?: number;
  igstRate?: number;
}

export interface PaymentTotals {
  gstMode: PaymentGstMode;
  taxableAmount: number;
  cgstRate: number | null;
  sgstRate: number | null;
  igstRate: number | null;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalAmount: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computePaymentTotals(input: ComputePaymentTotalsInput): PaymentTotals {
  const gstMode = input.gstMode;

  if (gstMode === 'NONE') {
    const totalAmount = input.amount;
    if (totalAmount == null || totalAmount <= 0) {
      throw new Error('Amount must be positive when GST is not included');
    }
    return {
      gstMode,
      taxableAmount: round2(totalAmount),
      cgstRate: null,
      sgstRate: null,
      igstRate: null,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      totalAmount: round2(totalAmount),
    };
  }

  const taxableAmount = input.taxableAmount;
  if (taxableAmount == null || taxableAmount <= 0) {
    throw new Error('Taxable amount must be positive when GST is included');
  }

  if (gstMode === 'CGST_SGST') {
    const cgstRate = input.cgstRate;
    const sgstRate = input.sgstRate;
    if (cgstRate == null || sgstRate == null) {
      throw new Error('CGST and SGST rates are required');
    }
    const cgstAmount = round2(taxableAmount * (cgstRate / 100));
    const sgstAmount = round2(taxableAmount * (sgstRate / 100));
    return {
      gstMode,
      taxableAmount: round2(taxableAmount),
      cgstRate,
      sgstRate,
      igstRate: null,
      cgstAmount,
      sgstAmount,
      igstAmount: 0,
      totalAmount: round2(taxableAmount + cgstAmount + sgstAmount),
    };
  }

  const igstRate = input.igstRate;
  if (igstRate == null) {
    throw new Error('IGST rate is required');
  }
  const igstAmount = round2(taxableAmount * (igstRate / 100));
  return {
    gstMode,
    taxableAmount: round2(taxableAmount),
    cgstRate: null,
    sgstRate: null,
    igstRate,
    cgstAmount: 0,
    sgstAmount: 0,
    igstAmount,
    totalAmount: round2(taxableAmount + igstAmount),
  };
}

export function formatInr(amount: number): string {
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
