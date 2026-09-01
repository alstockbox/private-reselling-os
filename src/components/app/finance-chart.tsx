"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatSek } from "@/lib/finance/money";

export function FinanceChart({ data }: { data: { month: string; revenue: number; profit: number }[] }) {
  if (data.length === 0) {
    return <div className="grid min-h-48 place-items-center rounded-[8px] bg-white/70 font-bold text-[var(--muted)]">Inga försäljningar ännu.</div>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ left: 0, right: 8, top: 12, bottom: 0 }}>
          <defs>
            <linearGradient id="profit" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#d93679" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#d93679" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#f1bfd2" strokeDasharray="3 3" />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#7b6675" }} />
          <YAxis tick={{ fontSize: 12, fill: "#7b6675" }} tickFormatter={(value) => formatSek(Number(value))} width={72} />
          <Tooltip formatter={(value) => formatSek(Number(value))} />
          <Area type="monotone" dataKey="revenue" name="Omsättning" stroke="#9b7cf6" fill="transparent" strokeWidth={2} />
          <Area type="monotone" dataKey="profit" name="Vinst" stroke="#d93679" fill="url(#profit)" strokeWidth={3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
