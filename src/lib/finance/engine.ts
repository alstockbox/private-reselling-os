import { clampOre, type Ore } from "./money";

export type AcquisitionInput = {
  purchasePriceOre: Ore;
  inboundShippingOre?: Ore;
  acquisitionFeeOre?: Ore;
  otherAcquisitionCostOre?: Ore;
};

export type SaleInput = {
  salePriceOre: Ore;
  sellerFeeOre?: Ore;
  sellerPaidShippingOre?: Ore;
  directSaleCostOre?: Ore;
  refundAmountOre?: Ore;
};

export type ProfitSplit = {
  reinvestmentPercentage: number;
  reservePercentage: number;
};

export type SaleCalculation = {
  acquisitionCostOre: Ore;
  netSaleProceedsOre: Ore;
  realizedProfitOre: Ore;
  profitMarginPercent: number | null;
  roiPercent: number | null;
  returnedCapitalOre: Ore;
  reinvestmentProfitOre: Ore;
  reserveProfitOre: Ore;
  reinvestmentCashFromSaleOre: Ore;
  reserveCashFromSaleOre: Ore;
};

export function acquisitionCost(input: AcquisitionInput): Ore {
  return (
    input.purchasePriceOre +
    (input.inboundShippingOre ?? 0) +
    (input.acquisitionFeeOre ?? 0) +
    (input.otherAcquisitionCostOre ?? 0)
  );
}

export function netSaleProceeds(input: SaleInput): Ore {
  return (
    input.salePriceOre -
    (input.sellerFeeOre ?? 0) -
    (input.sellerPaidShippingOre ?? 0) -
    (input.directSaleCostOre ?? 0) -
    (input.refundAmountOre ?? 0)
  );
}

export function validateSplit(split: ProfitSplit) {
  if (
    split.reinvestmentPercentage < 0 ||
    split.reservePercentage < 0 ||
    split.reinvestmentPercentage + split.reservePercentage !== 100
  ) {
    throw new Error("Fördelningen måste vara 100% totalt.");
  }
}

export function calculateSale(
  acquisition: AcquisitionInput,
  sale: SaleInput,
  split: ProfitSplit
): SaleCalculation {
  validateSplit(split);
  const acquisitionCostOre = acquisitionCost(acquisition);
  const netSaleProceedsOre = netSaleProceeds(sale);
  const realizedProfitOre = netSaleProceedsOre - acquisitionCostOre;
  const profitMarginPercent =
    sale.salePriceOre > 0 ? (realizedProfitOre / sale.salePriceOre) * 100 : null;
  const roiPercent =
    acquisitionCostOre > 0 ? (realizedProfitOre / acquisitionCostOre) * 100 : null;

  if (realizedProfitOre <= 0) {
    return {
      acquisitionCostOre,
      netSaleProceedsOre,
      realizedProfitOre,
      profitMarginPercent,
      roiPercent,
      returnedCapitalOre: 0,
      reinvestmentProfitOre: 0,
      reserveProfitOre: 0,
      reinvestmentCashFromSaleOre: netSaleProceedsOre,
      reserveCashFromSaleOre: 0
    };
  }

  const reserveProfitOre = clampOre((realizedProfitOre * split.reservePercentage) / 100);
  const reinvestmentProfitOre = realizedProfitOre - reserveProfitOre;

  return {
    acquisitionCostOre,
    netSaleProceedsOre,
    realizedProfitOre,
    profitMarginPercent,
    roiPercent,
    returnedCapitalOre: acquisitionCostOre,
    reinvestmentProfitOre,
    reserveProfitOre,
    reinvestmentCashFromSaleOre: acquisitionCostOre + reinvestmentProfitOre,
    reserveCashFromSaleOre: reserveProfitOre
  };
}

export type LedgerEntry = {
  envelope: "reinvestment" | "reserve";
  amountOre: Ore;
};

export function balancesFromLedger(entries: LedgerEntry[]) {
  return entries.reduce(
    (balances, entry) => {
      balances[entry.envelope] += entry.amountOre;
      return balances;
    },
    { reinvestment: 0, reserve: 0 }
  );
}
