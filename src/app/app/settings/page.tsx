import { logoutAction } from "@/lib/auth/actions";
import { getSettings, updateSettings } from "@/lib/reseller/db";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const [settings, params] = await Promise.all([getSettings(), searchParams]);

  return (
    <main className="mx-auto grid max-w-xl gap-5">
      <header>
        <p className="text-sm font-black uppercase text-[var(--primary-strong)]">Inställningar</p>
        <h1 className="display text-4xl font-black">Mer</h1>
      </header>

      {params.saved ? <p className="card bg-green-50 p-3 font-black text-[var(--success)]">Sparat.</p> : null}

      <section className="card p-5">
        <h2 className="mb-3 text-xl font-black">Vinstfördelning</h2>
        <p className="mb-4 text-sm font-bold text-[var(--muted)]">Endast positiv realiserad vinst delas. Förlust tas från återinvestering och ger aldrig minus till buffert.</p>
        <form action={updateSettings} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label>Återinvestering %</label>
              <input className="input" name="reinvestmentPercentage" type="number" min="0" max="100" defaultValue={settings?.reinvestment_percentage ?? 80} />
            </div>
            <div className="field">
              <label>Buffert %</label>
              <input className="input" name="reservePercentage" type="number" min="0" max="100" defaultValue={settings?.reserve_percentage ?? 20} />
            </div>
          </div>
          <button className="button">Spara</button>
        </form>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 text-xl font-black">Data</h2>
        <a className="button secondary w-full" href="/api/export">Exportera data</a>
      </section>

      <form action={logoutAction}>
        <button className="button secondary w-full">Logga ut</button>
      </form>
    </main>
  );
}
