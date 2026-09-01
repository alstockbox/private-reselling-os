import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { SoldForm } from "@/components/forms/sold-form";
import { getItem, markSold, requireSettings } from "@/lib/reseller/db";
import { formatPercent, formatSek } from "@/lib/finance/money";

export default async function ItemDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sold?: string }>;
}) {
  const [{ id }, query, settings] = await Promise.all([params, searchParams, requireSettings()]);
  const { item, sale } = await getItem(id);
  const soldAction = markSold.bind(null, item.id);

  return (
    <main className="mx-auto grid max-w-3xl gap-4">
      {query.sold ? (
        <section className="card gloss p-5 text-center">
          <p className="text-sm font-black uppercase text-[var(--primary-strong)]">Såld!</p>
          <p className="number mt-2 text-4xl font-black">{sale ? formatSek(sale.realized_profit_ore) : ""}</p>
          <p className="font-bold text-[var(--muted)]">vinst registrerad</p>
        </section>
      ) : null}

      <section className="card overflow-hidden bg-white">
        {item.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.image_url} alt="" className="max-h-[520px] w-full object-cover" />
        ) : (
          <div className="grid min-h-64 place-items-center bg-[var(--surface-pink)] text-xl font-black text-[var(--primary)]">Ingen bild</div>
        )}
        <div className="grid gap-4 p-5">
          <div>
            <p className="text-sm font-black uppercase text-[var(--primary-strong)]">{item.status === "SOLD" ? "Såld" : "Aktiv"}</p>
            <h1 className="display text-4xl font-black">{item.title}</h1>
            <p className="font-bold text-[var(--muted)]">{[item.brand, item.size, item.condition].filter(Boolean).join(" • ")}</p>
          </div>
          <InfoGrid
            rows={[
              ["Inköpspris", formatSek(item.purchase_price_ore)],
              ["Frakt/avgifter", formatSek(item.inbound_shipping_ore + item.acquisition_fee_ore + item.other_acquisition_cost_ore)],
              ["Totalt inköp", formatSek(item.acquisition_cost_ore)],
              ["Köpt från", item.source_platform ?? "-"],
              ["Pris ute för", item.asking_price_ore ? formatSek(item.asking_price_ore) : "-"],
              ["Säljs på", item.listing_platform ?? "-"]
            ]}
          />
          <div className="flex flex-wrap gap-2">
            {item.source_url ? <External href={item.source_url} label="Öppna inköpslänk" /> : null}
            {item.listing_url ? <External href={item.listing_url} label="Öppna annons" /> : null}
          </div>
        </div>
      </section>

      {sale ? <SaleSummary sale={sale} /> : (
        <section className="card p-5">
          <h2 className="mb-4 text-2xl font-black">Markera som såld</h2>
          <SoldForm
            item={item}
            action={soldAction}
            split={{
              reinvestmentPercentage: settings.reinvestment_percentage,
              reservePercentage: settings.reserve_percentage
            }}
          />
        </section>
      )}

      <Link className="button secondary" href="/app/inventory">Tillbaka till lager</Link>
    </main>
  );
}

function SaleSummary({ sale }: { sale: NonNullable<Awaited<ReturnType<typeof getItem>>["sale"]> }) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-2xl font-black">Försäljning</h2>
      <InfoGrid
        rows={[
          ["Såld för", formatSek(sale.sale_price_ore)],
          ["Netto efter säljkostnader", formatSek(sale.net_sale_proceeds_ore)],
          ["Vinst", formatSek(sale.realized_profit_ore)],
          ["Vinstmarginal", formatPercent(sale.profit_margin_bps === null ? null : sale.profit_margin_bps / 100)],
          ["ROI", formatPercent(sale.roi_bps === null ? null : sale.roi_bps / 100)],
          ["Till återinvestering", formatSek(sale.reinvestment_allocation_ore)],
          ["Till buffert", formatSek(sale.reserve_allocation_ore)]
        ]}
      />
    </section>
  );
}

function InfoGrid({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-2 gap-3">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-[8px] bg-[var(--background)] p-3">
          <dt className="text-xs font-black uppercase text-[var(--muted)]">{label}</dt>
          <dd className="number mt-1 font-black">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function External({ href, label }: { href: string; label: string }) {
  return (
    <a className="button secondary" href={href} target="_blank" rel="noopener noreferrer">
      {label} <ExternalLink size={16} />
    </a>
  );
}
