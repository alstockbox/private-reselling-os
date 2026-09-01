import { cache } from "react";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { acquisitionCost, calculateSale } from "@/lib/finance/engine";
import { toOre } from "@/lib/finance/money";
import type { AppSettings, InventoryItem, LedgerTransaction, SaleRecord } from "./types";

function supabaseOrThrow() {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Supabase är inte konfigurerat ännu.");
  return supabase;
}

export const getSettings = cache(async () => {
  const supabase = supabaseOrThrow();
  const { data, error } = await supabase.from("app_settings").select("*").maybeSingle();
  if (error) throw error;
  return data as AppSettings | null;
});

export async function requireSettings() {
  const settings = await getSettings();
  if (!settings?.onboarding_completed) redirect("/app/onboarding");
  return settings;
}

export async function listItems(filter: "active" | "sold" | "all" = "active", query = "", sort = "newest") {
  const supabase = supabaseOrThrow();
  let request = supabase.from("inventory_items").select("*");

  if (filter === "active") request = request.in("status", ["DRAFT", "ACTIVE"]);
  if (filter === "sold") request = request.eq("status", "SOLD");
  if (query) request = request.or(`title.ilike.%${query}%,brand.ilike.%${query}%,category.ilike.%${query}%`);

  const orderMap: Record<string, [keyof InventoryItem, boolean]> = {
    newest: ["created_at", false],
    oldest: ["created_at", true],
    purchase: ["acquisition_cost_ore", false],
    asking: ["asking_price_ore", false]
  };
  const [column, ascending] = orderMap[sort] ?? orderMap.newest;
  const { data, error } = await request.order(column, { ascending, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as InventoryItem[];
}

export async function getItem(id: string) {
  const supabase = supabaseOrThrow();
  const [{ data: item, error }, { data: sale, error: saleError }] = await Promise.all([
    supabase.from("inventory_items").select("*").eq("id", id).single(),
    supabase.from("sale_records").select("*").eq("item_id", id).maybeSingle()
  ]);
  if (error) throw error;
  if (saleError) throw saleError;
  return { item: item as InventoryItem, sale: sale as SaleRecord | null };
}

export async function getLedger(limit = 50) {
  const supabase = supabaseOrThrow();
  const { data, error } = await supabase
    .from("ledger_transactions")
    .select("*")
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as LedgerTransaction[];
}

export async function getSales() {
  const supabase = supabaseOrThrow();
  const { data, error } = await supabase.from("sale_records").select("*").order("sale_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SaleRecord[];
}

export async function getDashboardData() {
  const [settings, items, ledger, sales] = await Promise.all([
    requireSettings(),
    listItems("all"),
    getLedger(5000),
    getSales()
  ]);
  const active = items.filter((item) => item.status !== "SOLD" && item.status !== "ARCHIVED");
  const sold = items.filter((item) => item.status === "SOLD");
  const balances = ledger.reduce(
    (sum, tx) => {
      sum[tx.envelope] += tx.amount_ore;
      return sum;
    },
    { reinvestment: 0, reserve: 0 }
  );
  const now = new Date();
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthlySales = sales.filter((sale) => sale.sale_date.startsWith(monthPrefix));

  return {
    settings,
    items,
    active,
    sold,
    ledger: ledger.slice(0, 8),
    sales,
    balances,
    inventoryCostOre: active.reduce((sum, item) => sum + item.acquisition_cost_ore, 0),
    askingPotentialOre: active.reduce((sum, item) => sum + (item.asking_price_ore ?? 0), 0),
    monthlyRevenueOre: monthlySales.reduce((sum, sale) => sum + sale.sale_price_ore, 0),
    monthlyProfitOre: monthlySales.reduce((sum, sale) => sum + sale.realized_profit_ore, 0)
  };
}

function nullableText(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

function nullableUrl(value: FormDataEntryValue | null) {
  const text = nullableText(value);
  if (!text) return null;
  return z.string().url("Ange en giltig länk.").parse(text);
}

export async function completeOnboarding(formData: FormData) {
  "use server";
  await import("@/lib/auth/session").then((mod) => mod.requireOwner());
  const supabase = supabaseOrThrow();
  const startingCapitalOre = toOre(formData.get("startingCapital"));
  const reinvestmentPercentage = Number(formData.get("reinvestmentPercentage") ?? 80);
  const reservePercentage = Number(formData.get("reservePercentage") ?? 20);
  if (reinvestmentPercentage + reservePercentage !== 100) throw new Error("Fördelningen måste bli 100%.");

  const { data: settings, error } = await supabase
    .from("app_settings")
    .upsert({
      id: "owner",
      starting_capital_ore: startingCapitalOre,
      reinvestment_percentage: reinvestmentPercentage,
      reserve_percentage: reservePercentage,
      onboarding_completed: true
    })
    .select()
    .single();
  if (error) throw error;

  const { error: ledgerError } = await supabase.from("ledger_transactions").insert({
    type: "INITIAL_CAPITAL",
    envelope: "reinvestment",
    amount_ore: startingCapitalOre,
    occurred_on: new Date().toISOString().slice(0, 10),
    note: "Startkapital"
  });
  if (ledgerError) throw ledgerError;
  revalidatePath("/app");
  redirect("/app");
}

export async function createItem(formData: FormData) {
  "use server";
  await import("@/lib/auth/session").then((mod) => mod.requireOwner());
  const supabase = supabaseOrThrow();
  const purchasePriceOre = toOre(formData.get("purchasePrice"));
  const inboundShippingOre = toOre(formData.get("inboundShipping"));
  const acquisitionFeeOre = toOre(formData.get("acquisitionFee"));
  const otherAcquisitionCostOre = toOre(formData.get("otherAcquisitionCost"));
  const total = acquisitionCost({
    purchasePriceOre,
    inboundShippingOre,
    acquisitionFeeOre,
    otherAcquisitionCostOre
  });
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Titel saknas.");

  const { data: item, error } = await supabase
    .from("inventory_items")
    .insert({
      title,
      description: nullableText(formData.get("description")),
      image_url: nullableText(formData.get("imageUrl")),
      category: nullableText(formData.get("category")),
      brand: nullableText(formData.get("brand")),
      size: nullableText(formData.get("size")),
      condition: nullableText(formData.get("condition")),
      color: nullableText(formData.get("color")),
      purchase_price_ore: purchasePriceOre,
      inbound_shipping_ore: inboundShippingOre,
      acquisition_fee_ore: acquisitionFeeOre,
      other_acquisition_cost_ore: otherAcquisitionCostOre,
      acquisition_cost_ore: total,
      purchase_date: String(formData.get("purchaseDate") || new Date().toISOString().slice(0, 10)),
      source_platform: nullableText(formData.get("sourcePlatform")),
      source_url: nullableUrl(formData.get("sourceUrl")),
      source_notes: nullableText(formData.get("sourceNotes")),
      listing_platform: nullableText(formData.get("listingPlatform")),
      listing_url: nullableUrl(formData.get("listingUrl")),
      asking_price_ore: formData.get("askingPrice") ? toOre(formData.get("askingPrice")) : null,
      listing_date: nullableText(formData.get("listingDate")),
      listing_notes: nullableText(formData.get("listingNotes")),
      status: formData.get("askingPrice") ? "ACTIVE" : "DRAFT"
    })
    .select()
    .single();
  if (error) throw error;

  const { error: ledgerError } = await supabase.from("ledger_transactions").insert({
    type: "PURCHASE",
    envelope: "reinvestment",
    amount_ore: -total,
    item_id: item.id,
    occurred_on: item.purchase_date,
    note: `Inköp: ${title}`
  });
  if (ledgerError) throw ledgerError;
  revalidatePath("/app");
  redirect(`/app/inventory/${item.id}`);
}

export async function markSold(itemId: string, formData: FormData) {
  "use server";
  await import("@/lib/auth/session").then((mod) => mod.requireOwner());
  const settings = await requireSettings();
  const supabase = supabaseOrThrow();
  const { item } = await getItem(itemId);
  if (item.status === "SOLD") throw new Error("Plagget är redan markerat som sålt.");
  const calc = calculateSale(
    {
      purchasePriceOre: item.purchase_price_ore,
      inboundShippingOre: item.inbound_shipping_ore,
      acquisitionFeeOre: item.acquisition_fee_ore,
      otherAcquisitionCostOre: item.other_acquisition_cost_ore
    },
    {
      salePriceOre: toOre(formData.get("salePrice")),
      sellerFeeOre: toOre(formData.get("sellerFee")),
      sellerPaidShippingOre: toOre(formData.get("sellerPaidShipping")),
      directSaleCostOre: toOre(formData.get("directSaleCost")),
      refundAmountOre: toOre(formData.get("refundAmount"))
    },
    {
      reinvestmentPercentage: settings.reinvestment_percentage,
      reservePercentage: settings.reserve_percentage
    }
  );
  const saleDate = String(formData.get("saleDate") || new Date().toISOString().slice(0, 10));
  const platform = nullableText(formData.get("sellingPlatform")) ?? item.listing_platform;

  const { error: saleError } = await supabase.from("sale_records").insert({
    item_id: item.id,
    sale_price_ore: toOre(formData.get("salePrice")),
    seller_fee_ore: toOre(formData.get("sellerFee")),
    seller_paid_shipping_ore: toOre(formData.get("sellerPaidShipping")),
    direct_sale_cost_ore: toOre(formData.get("directSaleCost")),
    refund_amount_ore: toOre(formData.get("refundAmount")),
    sale_date: saleDate,
    selling_platform: platform,
    net_sale_proceeds_ore: calc.netSaleProceedsOre,
    realized_profit_ore: calc.realizedProfitOre,
    profit_margin_bps: calc.profitMarginPercent === null ? null : Math.round(calc.profitMarginPercent * 100),
    roi_bps: calc.roiPercent === null ? null : Math.round(calc.roiPercent * 100),
    reinvestment_allocation_ore: calc.reinvestmentProfitOre,
    reserve_allocation_ore: calc.reserveProfitOre
  });
  if (saleError) throw saleError;

  const entries: {
    type: string;
    envelope: string;
    amount_ore: number;
    item_id: string;
    occurred_on: string;
    note: string;
    metadata: Record<string, unknown>;
  }[] = [];

  if (calc.realizedProfitOre > 0) {
    entries.push({
      type: "SALE_RETURN_CAPITAL",
      envelope: "reinvestment",
      amount_ore: calc.returnedCapitalOre,
      item_id: item.id,
      occurred_on: saleDate,
      note: `Kapital tillbaka: ${item.title}`,
      metadata: calc as unknown as Record<string, unknown>
    });
    if (calc.reinvestmentProfitOre > 0) {
      entries.push({
        type: "SALE_REINVESTMENT_PROFIT",
        envelope: "reinvestment",
        amount_ore: calc.reinvestmentProfitOre,
        item_id: item.id,
        occurred_on: saleDate,
        note: `Återinvesterad vinst: ${item.title}`,
        metadata: calc as unknown as Record<string, unknown>
      });
    }
  } else {
    entries.push({
      type: "SALE_RETURN_CAPITAL",
      envelope: "reinvestment",
      amount_ore: calc.reinvestmentCashFromSaleOre,
      item_id: item.id,
      occurred_on: saleDate,
      note: `Såld: ${item.title}`,
      metadata: calc as unknown as Record<string, unknown>
    });
  }
  if (calc.reserveCashFromSaleOre > 0) {
    entries.push({
      type: "SALE_RESERVE_PROFIT",
      envelope: "reserve",
      amount_ore: calc.reserveCashFromSaleOre,
      item_id: item.id,
      occurred_on: saleDate,
      note: `Buffert från ${item.title}`,
      metadata: calc as unknown as Record<string, unknown>
    });
  }
  const { error: ledgerError } = await supabase.from("ledger_transactions").insert(entries);
  if (ledgerError) throw ledgerError;

  const { error: updateError } = await supabase
    .from("inventory_items")
    .update({ status: "SOLD", listing_platform: platform })
    .eq("id", item.id);
  if (updateError) throw updateError;
  revalidatePath("/app");
  redirect(`/app/inventory/${item.id}?sold=1`);
}

export async function manualTransaction(formData: FormData) {
  "use server";
  await import("@/lib/auth/session").then((mod) => mod.requireOwner());
  const supabase = supabaseOrThrow();
  const action = String(formData.get("action"));
  const amountOre = toOre(formData.get("amount"));
  const note = nullableText(formData.get("note"));
  const date = String(formData.get("date") || new Date().toISOString().slice(0, 10));
  const inserts =
    action === "transfer-reserve"
      ? [
          { type: "TRANSFER_TO_RESERVE", envelope: "reinvestment", amount_ore: -amountOre, occurred_on: date, note },
          { type: "TRANSFER_TO_RESERVE", envelope: "reserve", amount_ore: amountOre, occurred_on: date, note }
        ]
      : action === "transfer-reinvestment"
        ? [
            { type: "TRANSFER_TO_REINVESTMENT", envelope: "reserve", amount_ore: -amountOre, occurred_on: date, note },
            { type: "TRANSFER_TO_REINVESTMENT", envelope: "reinvestment", amount_ore: amountOre, occurred_on: date, note }
          ]
        : [
            {
              type:
                action === "deposit"
                  ? "DEPOSIT"
                  : action === "withdrawal"
                    ? "WITHDRAWAL"
                    : action === "expense"
                      ? "OPERATING_EXPENSE"
                      : "ADJUSTMENT",
              envelope: "reinvestment",
              amount_ore: action === "deposit" || action === "adjustment" ? amountOre : -amountOre,
              occurred_on: date,
              note
            }
          ];

  const { error } = await supabase.from("ledger_transactions").insert(inserts);
  if (error) throw error;
  revalidatePath("/app");
  redirect("/app/finance");
}

export async function updateSettings(formData: FormData) {
  "use server";
  await import("@/lib/auth/session").then((mod) => mod.requireOwner());
  const reinvestmentPercentage = Number(formData.get("reinvestmentPercentage"));
  const reservePercentage = Number(formData.get("reservePercentage"));
  if (reinvestmentPercentage + reservePercentage !== 100) throw new Error("Fördelningen måste bli 100%.");
  const supabase = supabaseOrThrow();
  const { error } = await supabase
    .from("app_settings")
    .update({ reinvestment_percentage: reinvestmentPercentage, reserve_percentage: reservePercentage })
    .eq("id", "owner");
  if (error) throw error;
  revalidatePath("/app");
  redirect("/app/settings?saved=1");
}
