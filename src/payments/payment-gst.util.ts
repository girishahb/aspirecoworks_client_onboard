export type PaymentGstMode = 'NONE' | 'CGST_SGST' | 'IGST';

export interface ComputePaymentTotalsInput {
  gstMode?: PaymentGstMode;
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
  const gstMode: PaymentGstMode = input.gstMode ?? 'NONE';

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
      throw new Error('CGST and SGST rates are required for CGST_SGST mode');
    }
    const cgstAmount = round2(taxableAmount * (cgstRate / 100));
    const sgstAmount = round2(taxableAmount * (sgstRate / 100));
    const igstAmount = 0;
    const totalAmount = round2(taxableAmount + cgstAmount + sgstAmount + igstAmount);
    return {
      gstMode,
      taxableAmount: round2(taxableAmount),
      cgstRate,
      sgstRate,
      igstRate: null,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalAmount,
    };
  }

  const igstRate = input.igstRate;
  if (igstRate == null) {
    throw new Error('IGST rate is required for IGST mode');
  }
  const cgstAmount = 0;
  const sgstAmount = 0;
  const igstAmount = round2(taxableAmount * (igstRate / 100));
  const totalAmount = round2(taxableAmount + igstAmount);
  return {
    gstMode,
    taxableAmount: round2(taxableAmount),
    cgstRate: null,
    sgstRate: null,
    igstRate,
    cgstAmount,
    sgstAmount,
    igstAmount,
    totalAmount,
  };
}

export interface PaymentGstBreakdownEmail {
  hasGst: boolean;
  taxableAmount?: string;
  cgstLabel?: string;
  cgstAmount?: string;
  sgstLabel?: string;
  sgstAmount?: string;
  igstLabel?: string;
  igstAmount?: string;
  totalAmount: string;
}

export function formatPaymentAmountForEmail(
  totals: Pick<
    PaymentTotals,
    'gstMode' | 'taxableAmount' | 'cgstRate' | 'sgstRate' | 'igstRate' | 'cgstAmount' | 'sgstAmount' | 'igstAmount' | 'totalAmount'
  >,
  currency: string,
): PaymentGstBreakdownEmail {
  const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (totals.gstMode === 'NONE') {
    return {
      hasGst: false,
      totalAmount: `${currency} ${fmt(totals.totalAmount)}`,
    };
  }

  const base: PaymentGstBreakdownEmail = {
    hasGst: true,
    taxableAmount: `${currency} ${fmt(totals.taxableAmount)}`,
    totalAmount: `${currency} ${fmt(totals.totalAmount)}`,
  };

  if (totals.gstMode === 'CGST_SGST') {
    return {
      ...base,
      cgstLabel: `CGST (${totals.cgstRate}%)`,
      cgstAmount: `${currency} ${fmt(totals.cgstAmount)}`,
      sgstLabel: `SGST (${totals.sgstRate}%)`,
      sgstAmount: `${currency} ${fmt(totals.sgstAmount)}`,
    };
  }

  return {
    ...base,
    igstLabel: `IGST (${totals.igstRate}%)`,
    igstAmount: `${currency} ${fmt(totals.igstAmount)}`,
  };
}
