import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, PiggyBank, Plus, Shirt, Wallet } from "lucide-react";
import { getDashboardData } from "@/lib/reseller/db";
import { formatSek } from "@/lib/finance/money";
import { ItemCard } from "@/components/app/item-card";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const recentActive = data.active.slice(0, 2);

  return (
    <main className="grid gap-5">
      <header>
        <p className="text-sm font-black uppercase text-[var(--primary-strong)]">{new Date().toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1 className="display text-3xl font-black">Hej, fynddrottning</h1>
      </header>

      <section className="card gloss p-5 text-center">
        <p className="text-sm font-black uppercase text-[var(--primary-strong)]">Du kan köpa in för</p>
        <p className="number my-3 text-5xl font-black tracking-normal text-[var(--ink)]">{formatSek(data.balances.reinvestment)}</p>
        <p className="font-bold text-[var(--muted)]">pengar redo för nya fynd</p>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi icon={<PiggyBank size={18} />} label="Buffert" value={formatSek(data.balances.reserve)} />
        <Kpi icon={<Wallet size={18} />} label="Månadsvinst" value={formatSek(data.monthlyProfitOre)} />
        <Kpi icon={<CalendarDays size={18} />} label="Omsättning" value={formatSek(data.monthlyRevenueOre)} />
        <Kpi icon={<Shirt size={18} />} label="Aktiva plagg" value={String(data.active.length)} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link href="/app/inventory/new" className="button"><Plus size={18} /> Nytt plagg</Link>
        <Link href="/app/inventory" className="button secondary"><Shirt size={18} /> Visa lager</Link>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-xl font-black">Lager</h2>
        <div className="grid grid-cols-2 gap-3">
          <Kpi label="Kapital i lager" value={formatSek(data.inventoryCostOre)} />
          <Kpi label="Förväntad försäljning" value={formatSek(data.askingPotentialOre)} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-black">Senaste plagg</h2>
          <Link className="text-sm font-black text-[var(--primary-strong)]" href="/app/inventory">Alla</Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {recentActive.length ? recentActive.map((item) => <ItemCard key={item.id} item={item} />) : <Empty text="Lägg in ditt första plagg så börjar översikten leva." />}
        </div>
      </section>
    </main>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return (
    <div className="card bg-white/85 p-4">
      <div className="mb-2 text-[var(--primary-strong)]">{icon}</div>
      <p className="text-sm font-black text-[var(--muted)]">{label}</p>
      <p className="number text-2xl font-black">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="card p-5 text-center font-bold text-[var(--muted)]">{text}</div>;
}
