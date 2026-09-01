import { manualTransaction, getDashboardData } from "@/lib/reseller/db";
import { formatSek } from "@/lib/finance/money";
import { FinanceChart } from "@/components/app/finance-chart";

export default async function FinancePage() {
  const data = await getDashboardData();
  const monthly = new Map<string, { month: string; revenue: number; profit: number }>();
  for (const sale of data.sales) {
    const month = sale.sale_date.slice(0, 7);
    const current = monthly.get(month) ?? { month, revenue: 0, profit: 0 };
    current.revenue += sale.sale_price_ore;
    current.profit += sale.realized_profit_ore;
    monthly.set(month, current);
  }
  const lifetimeRevenue = data.sales.reduce((sum, sale) => sum + sale.sale_price_ore, 0);
  const lifetimeProfit = data.sales.reduce((sum, sale) => sum + sale.realized_profit_ore, 0);
  const averageProfit = data.sales.length ? Math.round(lifetimeProfit / data.sales.length) : 0;

  return (
    <main className="grid gap-5">
      <header>
        <p className="text-sm font-black uppercase text-[var(--primary-strong)]">Ekonomi</p>
        <h1 className="display text-4xl font-black">Pengarna</h1>
      </header>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Till inköp" value={formatSek(data.balances.reinvestment)} />
        <Kpi label="Buffert" value={formatSek(data.balances.reserve)} />
        <Kpi label="Lagervärde" value={formatSek(data.inventoryCostOre)} />
        <Kpi label="Total position" value={formatSek(data.balances.reinvestment + data.balances.reserve + data.inventoryCostOre)} />
        <Kpi label="Livstidsomsättning" value={formatSek(lifetimeRevenue)} />
        <Kpi label="Livstidsvinst" value={formatSek(lifetimeProfit)} />
        <Kpi label="Snittvinst" value={formatSek(averageProfit)} />
        <Kpi label="Sålda plagg" value={String(data.sales.length)} />
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-xl font-black">Omsättning och vinst per månad</h2>
        <FinanceChart data={[...monthly.values()]} />
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-xl font-black">Manuella händelser</h2>
        <form action={manualTransaction} className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_2fr_auto]">
          <select className="input" name="action" required>
            <option value="deposit">Sätt in pengar</option>
            <option value="withdrawal">Ta ut pengar</option>
            <option value="expense">Lägg till kostnad</option>
            <option value="transfer-reserve">Flytta till buffert</option>
            <option value="transfer-reinvestment">Flytta till inköp</option>
            <option value="adjustment">Justera saldo</option>
          </select>
          <input className="input" name="amount" inputMode="decimal" placeholder="Belopp" required />
          <input className="input" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          <input className="input" name="note" placeholder="Anteckning eller kategori" />
          <button className="button">Spara</button>
        </form>
      </section>

      <section className="card p-4">
        <h2 className="mb-3 text-xl font-black">Transaktionshistorik</h2>
        <div className="grid gap-2">
          {data.ledger.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between gap-3 rounded-[8px] bg-white p-3">
              <div>
                <p className="font-black">{tx.note ?? labels[tx.type] ?? tx.type}</p>
                <p className="text-sm font-bold text-[var(--muted)]">{new Date(tx.occurred_on).toLocaleDateString("sv-SE")} • {tx.envelope === "reserve" ? "Buffert" : "Återinvestering"}</p>
              </div>
              <p className={`number font-black ${tx.amount_ore < 0 ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>{tx.amount_ore < 0 ? "" : "+"}{formatSek(tx.amount_ore)}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

const labels: Record<string, string> = {
  INITIAL_CAPITAL: "Startkapital",
  PURCHASE: "Inköp",
  OPERATING_EXPENSE: "Kostnad",
  DEPOSIT: "Insättning",
  WITHDRAWAL: "Uttag",
  ADJUSTMENT: "Justering"
};

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="card bg-white/85 p-4">
      <p className="text-sm font-black text-[var(--muted)]">{label}</p>
      <p className="number text-2xl font-black">{value}</p>
    </div>
  );
}
