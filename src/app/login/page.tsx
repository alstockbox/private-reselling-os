import { LoginForm } from "@/components/forms/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="card gloss w-full max-w-md p-6">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-[8px] border border-white bg-[var(--primary)] text-3xl font-black text-white shadow-xl">
            S
          </div>
          <p className="text-sm font-black uppercase tracking-[0.12em] text-[var(--primary-strong)]">welcome back</p>
          <h1 className="display mt-1 text-4xl font-black">StockBox Resale</h1>
          <p className="mt-2 text-[var(--muted)]">redo för fler fynd?</p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
