import Link from "next/link";
import { Home, Plus, Settings, Shirt, Wallet } from "lucide-react";

const nav = [
  { href: "/app", label: "Översikt", icon: Home },
  { href: "/app/inventory", label: "Lager", icon: Shirt },
  { href: "/app/inventory/new", label: "Nytt", icon: Plus, primary: true },
  { href: "/app/finance", label: "Ekonomi", icon: Wallet },
  { href: "/app/settings", label: "Mer", icon: Settings }
];

export function AppNav() {
  return (
    <nav className="bottom-nav">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1 md:flex md:h-full md:flex-col md:items-center md:justify-center md:gap-4">
        {nav.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-12 flex-col items-center justify-center gap-1 rounded-[8px] text-[0.72rem] font-black ${
                item.primary ? "bg-[var(--primary)] text-white shadow-lg" : "text-[var(--muted)]"
              }`}
              title={item.label}
            >
              <Icon size={item.primary ? 22 : 20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
