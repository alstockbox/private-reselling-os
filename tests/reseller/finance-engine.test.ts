import { describe, expect, it } from "vitest";
import { balancesFromLedger, calculateSale } from "@/lib/finance/engine";

const split = { reinvestmentPercentage: 80, reservePercentage: 20 };

describe("reseller finance engine", () => {
  it("reconciles the required 1000 -> buy 50 -> sell 100 example", () => {
    const sale = calculateSale({ purchasePriceOre: 5000 }, { salePriceOre: 10000 }, split);
    const balances = balancesFromLedger([
      { envelope: "reinvestment", amountOre: 100000 },
      { envelope: "reinvestment", amountOre: -5000 },
      { envelope: "reinvestment", amountOre: sale.reinvestmentCashFromSaleOre },
      { envelope: "reserve", amountOre: sale.reserveCashFromSaleOre }
    ]);

    expect(sale.realizedProfitOre).toBe(5000);
    expect(sale.profitMarginPercent).toBe(50);
    expect(sale.roiPercent).toBe(100);
    expect(balances.reinvestment).toBe(104000);
    expect(balances.reserve).toBe(1000);
    expect(balances.reinvestment + balances.reserve).toBe(105000);
  });

  it("calculates profit, margin, and ROI for a 299 SEK item sold for 600 SEK", () => {
    const sale = calculateSale({ purchasePriceOre: 29900 }, { salePriceOre: 60000 }, split);

    expect(sale.realizedProfitOre).toBe(30100);
    expect(sale.profitMarginPercent).toBeCloseTo(50.166, 3);
    expect(sale.roiPercent).toBeCloseTo(100.669, 3);
  });

  it("absorbs losses in reinvestment and never creates fake reserve contribution", () => {
    const sale = calculateSale({ purchasePriceOre: 50000 }, { salePriceOre: 40000 }, split);
    const balances = balancesFromLedger([
      { envelope: "reinvestment", amountOre: 100000 },
      { envelope: "reinvestment", amountOre: -50000 },
      { envelope: "reinvestment", amountOre: sale.reinvestmentCashFromSaleOre },
      { envelope: "reserve", amountOre: sale.reserveCashFromSaleOre }
    ]);

    expect(sale.realizedProfitOre).toBe(-10000);
    expect(sale.reserveProfitOre).toBe(0);
    expect(sale.reinvestmentCashFromSaleOre).toBe(40000);
    expect(balances.reinvestment).toBe(90000);
    expect(balances.reserve).toBe(0);
  });

  it("subtracts seller fee and direct shipping before splitting profit", () => {
    const sale = calculateSale(
      { purchasePriceOre: 10000 },
      { salePriceOre: 20000, sellerFeeOre: 2000, directSaleCostOre: 1000 },
      split
    );

    expect(sale.netSaleProceedsOre).toBe(17000);
    expect(sale.realizedProfitOre).toBe(7000);
    expect(sale.reinvestmentProfitOre).toBe(5600);
    expect(sale.reserveProfitOre).toBe(1400);
    expect(sale.reinvestmentCashFromSaleOre + sale.reserveCashFromSaleOre).toBe(17000);
  });

  it("assigns rounding remainders to reinvestment so allocations always reconcile", () => {
    const sale = calculateSale({ purchasePriceOre: 10000 }, { salePriceOre: 10003 }, split);

    expect(sale.realizedProfitOre).toBe(3);
    expect(sale.reserveProfitOre).toBe(1);
    expect(sale.reinvestmentProfitOre).toBe(2);
    expect(sale.reinvestmentProfitOre + sale.reserveProfitOre).toBe(sale.realizedProfitOre);
  });
});
