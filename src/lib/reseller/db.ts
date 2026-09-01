import { cache } from "react";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const { error } = await supabase.rpc("complete_onboarding_tx", {
    p_starting_capital_ore: startingCapitalOre,
    p_reinvestment_percentage: reinvestmentPercentage,
    p_reserve_percentage: reservePercentage
  });
  if (error) throw error;
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
  const title = String(formData.get("title") ?? "").trim();
  if (!title) throw new Error("Titel saknas.");
  const askingPriceText = String(formData.get("askingPrice") ?? "").trim();

  const { data: itemId, error } = await supabase.rpc("create_item_with_purchase_tx", {
    p_title: title,
    p_description: nullableText(formData.get("description")),
    p_image_url: nullableText(formData.get("imageUrl")),
    p_category: nullableText(formData.get("category")),
    p_brand: nullableText(formData.get("brand")),
    p_size: nullableText(formData.get("size")),
    p_condition: nullableText(formData.get("condition")),
    p_color: nullableText(formData.get("color")),
    p_purchase_price_ore: purchasePriceOre,
    p_inbound_shipping_ore: inboundShippingOre,
    p_acquisition_fee_ore: acquisitionFeeOre,
    p_other_acquisition_cost_ore: otherAcquisitionCostOre,
    p_purchase_date: String(formData.get("purchaseDate") || new Date().toISOString().slice(0, 10)),
    p_source_platform: nullableText(formData.get("sourcePlatform")),
    p_source_url: nullableUrl(formData.get("sourceUrl")),
    p_source_notes: nullableText(formData.get("sourceNotes")),
    p_listing_platform: nullableText(formData.get("listingPlatform")),
    p_listing_url: nullableUrl(formData.get("listingUrl")),
    p_asking_price_ore: askingPriceText ? toOre(askingPriceText) : null,
    p_listing_date: nullableText(formData.get("listingDate")),
    p_listing_notes: nullableText(formData.get("listingNotes")),
    p_status: askingPriceText ? "ACTIVE" : "DRAFT"
  });
  if (error) throw error;
  revalidatePath("/app");
  redirect(`/app/inventory/${itemId}`);
}

export async function markSold(itemId: string, formData: FormData) {
  "use server";
  await import("@/lib/auth/session").then((mod) => mod.requireOwner());
  const supabase = supabaseOrThrow();
  const saleDate = String(formData.get("saleDate") || new Date().toISOString().slice(0, 10));
  const { error } = await supabase.rpc("mark_item_sold_tx", {
    p_item_id: itemId,
    p_sale_price_ore: toOre(formData.get("salePrice")),
    p_seller_fee_ore: toOre(formData.get("sellerFee")),
    p_seller_paid_shipping_ore: toOre(formData.get("sellerPaidShipping")),
    p_direct_sale_cost_ore: toOre(formData.get("directSaleCost")),
    p_refund_amount_ore: toOre(formData.get("refundAmount")),
    p_sale_date: saleDate,
    p_selling_platform: nullableText(formData.get("sellingPlatform"))
  });
  if (error) throw error;
  revalidatePath("/app");
  redirect(`/app/inventory/${itemId}?sold=1`);
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
