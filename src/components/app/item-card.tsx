import Link from "next/link";
import { Sparkles } from "lucide-react";
import { formatSek } from "@/lib/finance/money";
import type { InventoryItem } from "@/lib/reseller/types";

export function ItemCard({ item }: { item: InventoryItem }) {
  const potential = (item.asking_price_ore ?? 0) - item.acquisition_cost_ore;
  return (
    <Link href={`/app/inventory/${item.id}`} className="card block overflow-hidden bg-white">
      {item.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image_url} alt="" className="aspect-[4/3] w-full object-cover" />
      ) : (
        <div className="grid aspect-[4/3] place-items-center bg-[var(--surface-pink)] text-[var(--primary)]">
          <Sparkles />
        </div>
      )}
      <div className="grid gap-3 p-4">
        <div>
          <h3 className="line-clamp-2 text-lg font-black">{item.title}</h3>
          <p className="text-sm font-bold text-[var(--muted)]">{item.brand ?? item.category ?? item.source_platform ?? "Plagg"}</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Mini label="Inköp" value={formatSek(item.acquisition_cost_ore)} />
          <Mini label="Ute för" value={item.asking_price_ore ? formatSek(item.asking_price_ore) : "-"} />
          <Mini label="Potential" value={item.asking_price_ore ? formatSek(potential) : "-"} />
        </div>
        <span className="button w-full">{item.status === "SOLD" ? "Visa försäljning" : "Markera som såld"}</span>
      </div>
    </Link>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.72rem] font-black uppercase text-[var(--muted)]">{label}</p>
      <p className="number font-black">{value}</p>
    </div>
  );
}
