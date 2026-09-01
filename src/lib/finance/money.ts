export type Ore = number;

const SEK_FORMAT = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
  maximumFractionDigits: 0
});

const SEK_DECIMAL_FORMAT = new Intl.NumberFormat("sv-SE", {
  style: "currency",
  currency: "SEK",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export function toOre(value: FormDataEntryValue | string | number | null | undefined): Ore {
  if (value === null || value === undefined || value === "") return 0;
  const normalized = String(value).replace(/\s/g, "").replace(",", ".");
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error("Belopp måste vara ett positivt nummer.");
  }
  return Math.round(number * 100);
}

export function formatSek(ore: Ore, options: { decimals?: boolean } = {}) {
  return (options.decimals ? SEK_DECIMAL_FORMAT : SEK_FORMAT).format(ore / 100);
}

export function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 1 }).format(value)}%`;
}

export function clampOre(value: number): Ore {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}
