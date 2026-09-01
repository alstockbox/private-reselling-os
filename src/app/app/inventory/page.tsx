import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { ItemCard } from "@/components/app/item-card";
import { listItems } from "@/lib/reseller/db";

export default async function InventoryPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: "active" | "sold" | "all"; q?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const filter = params.filter ?? "active";
  const items = await listItems(filter, params.q ?? "", params.sort ?? "newest");

  return (
    <main className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase text-[var(--primary-strong)]">Lager</p>
          <h1 className="display text-4xl font-black">Plagg</h1>
        </div>
        <Link className="button" href="/app/inventory/new" aria-label="Nytt plagg"><Plus size={18} /></Link>
      </div>

      <form className="card grid gap-3 p-3 sm:grid-cols-[1fr_auto]" action="/app/inventory">
        <div className="flex items-center gap-2 rounded-[8px] bg-white px-3">
          <Search size={18} className="text-[var(--muted)]" />
          <input className="min-h-11 min-w-0 flex-1 border-0 bg-transparent" name="q" defaultValue={params.q ?? ""} placeholder="Sök titel, märke, kategori" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <select className="input" name="filter" defaultValue={filter}>
            <option value="active">Aktiva</option>
            <option value="sold">Sålda</option>
            <option value="all">Alla</option>
          </select>
          <select className="input" name="sort" defaultValue={params.sort ?? "newest"}>
            <option value="newest">Nyast</option>
            <option value="oldest">Äldst</option>
            <option value="purchase">Högst inköp</option>
            <option value="asking">Högst pris</option>
          </select>
          <button className="button secondary">Visa</button>
        </div>
      </form>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.length ? (
          items.map((item) => <ItemCard key={item.id} item={item} />)
        ) : (
          <div className="card p-6 text-center font-bold text-[var(--muted)]">Inga plagg här ännu.</div>
        )}
      </div>
    </main>
  );
}
