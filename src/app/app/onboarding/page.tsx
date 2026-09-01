import { completeOnboarding } from "@/lib/reseller/db";

export default function OnboardingPage() {
  return (
    <main className="mx-auto max-w-lg">
      <section className="card gloss p-5">
        <p className="text-sm font-black uppercase text-[var(--primary-strong)]">Första starten</p>
        <h1 className="display mt-1 text-4xl font-black">Vi sätter pengarna på plats</h1>
        <form action={completeOnboarding} className="mt-6 grid gap-4">
          <div className="field">
            <label>Hur mycket pengar börjar du med?</label>
            <input className="input" name="startingCapital" inputMode="decimal" placeholder="3 000" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label>Återinvestering %</label>
              <input className="input" name="reinvestmentPercentage" type="number" min="0" max="100" defaultValue="80" required />
            </div>
            <div className="field">
              <label>Buffert %</label>
              <input className="input" name="reservePercentage" type="number" min="0" max="100" defaultValue="20" required />
            </div>
          </div>
          <button className="button">Klart</button>
        </form>
      </section>
    </main>
  );
}
