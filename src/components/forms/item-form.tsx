"use client";

import { useMemo, useState } from "react";
import { categoryOptions, conditionOptions, platformOptions } from "@/lib/reseller/constants";
import { ImageUploader } from "./image-uploader";
import { formatSek } from "@/lib/finance/money";

export function ItemForm({ action }: { action: (formData: FormData) => Promise<void> }) {
  const [purchasePrice, setPurchasePrice] = useState("");
  const [shipping, setShipping] = useState("");
  const [fee, setFee] = useState("");
  const [other, setOther] = useState("");
  const total = useMemo(() => {
    const parse = (value: string) => Math.max(0, Number(value.replace(",", ".")) || 0);
    return Math.round((parse(purchasePrice) + parse(shipping) + parse(fee) + parse(other)) * 100);
  }, [purchasePrice, shipping, fee, other]);

  return (
    <form action={action} className="grid gap-5">
      <ImageUploader />
      <div className="field">
        <label>Titel</label>
        <input className="input" name="title" placeholder="Ralph Lauren sneakers" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <MoneyField label="Inköpspris" name="purchasePrice" value={purchasePrice} onChange={setPurchasePrice} required />
        <MoneyField label="Frakt" name="inboundShipping" value={shipping} onChange={setShipping} />
        <MoneyField label="Avgift" name="acquisitionFee" value={fee} onChange={setFee} />
        <MoneyField label="Övrigt" name="otherAcquisitionCost" value={other} onChange={setOther} />
      </div>
      <div className="card bg-white/80 p-4">
        <p className="text-sm font-black text-[var(--muted)]">Totalt inköp</p>
        <p className="number text-3xl font-black text-[var(--primary-strong)]">{formatSek(total)}</p>
      </div>
      <div className="grid gap-3">
        <div className="field">
          <label>Köpt från</label>
          <select className="input" name="sourcePlatform" defaultValue="Vinted">
            {platformOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Inköpslänk</label>
          <input className="input" name="sourceUrl" type="url" placeholder="https://..." />
        </div>
        <div className="field">
          <label>Datum</label>
          <input className="input" name="purchaseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
      </div>
      <details className="card p-4">
        <summary className="cursor-pointer font-black text-[var(--primary-strong)]">Fler detaljer</summary>
        <div className="mt-4 grid gap-3">
          <input className="input" name="brand" placeholder="Märke" />
          <select className="input" name="category" defaultValue="">
            <option value="">Kategori</option>
            {categoryOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <input className="input" name="size" placeholder="Storlek" />
          <select className="input" name="condition" defaultValue="">
            <option value="">Skick</option>
            {conditionOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <input className="input" name="color" placeholder="Färg" />
          <textarea className="input min-h-24" name="description" placeholder="Anteckningar" />
        </div>
      </details>
      <details className="card p-4">
        <summary className="cursor-pointer font-black text-[var(--primary-strong)]">Säljinformation</summary>
        <div className="mt-4 grid gap-3">
          <select className="input" name="listingPlatform" defaultValue="">
            <option value="">Säljs på</option>
            {platformOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <input className="input" name="askingPrice" inputMode="decimal" placeholder="Pris ute för" />
          <input className="input" name="listingUrl" type="url" placeholder="Annonslänk" />
          <input className="input" name="listingDate" type="date" />
        </div>
      </details>
      <button className="button">Spara plagg</button>
    </form>
  );
}

function MoneyField(props: {
  label: string;
  name: string;
  value: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <label>{props.label}</label>
      <input
        className="input"
        name={props.name}
        inputMode="decimal"
        value={props.value}
        required={props.required}
        onChange={(event) => props.onChange(event.target.value)}
        placeholder="0"
      />
    </div>
  );
}
