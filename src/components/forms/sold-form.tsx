"use client";

import { useMemo, useState } from "react";
import { calculateSale } from "@/lib/finance/engine";
import { formatPercent, formatSek } from "@/lib/finance/money";
import type { InventoryItem } from "@/lib/reseller/types";
import { platformOptions } from "@/lib/reseller/constants";

export function SoldForm({
  item,
  action,
  split
}: {
  item: InventoryItem;
  action: (formData: FormData) => Promise<void>;
  split: { reinvestmentPercentage: number; reservePercentage: number };
}) {
  const [salePrice, setSalePrice] = useState("");
  const [sellerFee, setSellerFee] = useState("");
  const [shipping, setShipping] = useState("");
  const [cost, setCost] = useState("");
  const calc = useMemo(() => {
    const ore = (value: string) => Math.round((Number(value.replace(",", ".")) || 0) * 100);
    return calculateSale(
      {
        purchasePriceOre: item.purchase_price_ore,
        inboundShippingOre: item.inbound_shipping_ore,
        acquisitionFeeOre: item.acquisition_fee_ore,
        otherAcquisitionCostOre: item.other_acquisition_cost_ore
      },
      {
        salePriceOre: ore(salePrice),
        sellerFeeOre: ore(sellerFee),
        sellerPaidShippingOre: ore(shipping),
        directSaleCostOre: ore(cost)
      },
      split
    );
  }, [cost, item, salePrice, sellerFee, shipping, split]);

  return (
    <form action={action} className="grid gap-4">
      <div className="field">
        <label>Såld för</label>
        <input className="input" name="salePrice" inputMode="decimal" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MoneyInput label="Avgift" name="sellerFee" value={sellerFee} setValue={setSellerFee} />
        <MoneyInput label="Frakt" name="sellerPaidShipping" value={shipping} setValue={setShipping} />
        <MoneyInput label="Pack/kostnad" name="directSaleCost" value={cost} setValue={setCost} />
        <MoneyInput label="Återbetalning" name="refundAmount" value="" setValue={() => null} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="field">
          <label>Säljplattform</label>
          <select className="input" name="sellingPlatform" defaultValue={item.listing_platform ?? "Vinted"}>
            {platformOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Datum</label>
          <input className="input" name="saleDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
      </div>
      <div className="card gloss grid gap-3 p-4">
        <Metric label="Vinst" value={formatSek(calc.realizedProfitOre)} good={calc.realizedProfitOre >= 0} />
        <Metric label="Vinstmarginal" value={formatPercent(calc.profitMarginPercent)} />
        <Metric label="ROI" value={formatPercent(calc.roiPercent)} />
        <Metric label="Till återinvestering" value={formatSek(calc.reinvestmentProfitOre)} />
        <Metric label="Till buffert" value={formatSek(calc.reserveProfitOre)} />
      </div>
      <button className="button">Bekräfta försäljning</button>
    </form>
  );
}

function MoneyInput({ label, name, value, setValue }: { label: string; name: string; value: string; setValue: (value: string) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input className="input" name={name} inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} placeholder="0" />
    </div>
  );
}

function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-black text-[var(--muted)]">{label}</span>
      <span className={`number font-black ${good === false ? "text-[var(--danger)]" : "text-[var(--ink)]"}`}>{value}</span>
    </div>
  );
}
