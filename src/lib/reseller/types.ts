import type { Ore } from "@/lib/finance/money";

export type ItemStatus = "DRAFT" | "ACTIVE" | "SOLD" | "RETURNED" | "ARCHIVED";
export type Envelope = "reinvestment" | "reserve";
export type TransactionType =
  | "INITIAL_CAPITAL"
  | "PURCHASE"
  | "SALE_RETURN_CAPITAL"
  | "SALE_REINVESTMENT_PROFIT"
  | "SALE_RESERVE_PROFIT"
  | "OPERATING_EXPENSE"
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "TRANSFER_TO_RESERVE"
  | "TRANSFER_TO_REINVESTMENT"
  | "ADJUSTMENT";

export type AppSettings = {
  id: string;
  starting_capital_ore: Ore;
  reinvestment_percentage: number;
  reserve_percentage: number;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
};

export type InventoryItem = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  category: string | null;
  brand: string | null;
  size: string | null;
  condition: string | null;
  color: string | null;
  sku: string;
  purchase_price_ore: Ore;
  inbound_shipping_ore: Ore;
  acquisition_fee_ore: Ore;
  other_acquisition_cost_ore: Ore;
  acquisition_cost_ore: Ore;
  purchase_date: string;
  source_platform: string | null;
  source_url: string | null;
  source_notes: string | null;
  listing_platform: string | null;
  listing_url: string | null;
  asking_price_ore: Ore | null;
  listing_date: string | null;
  listing_notes: string | null;
  status: ItemStatus;
  created_at: string;
  updated_at: string;
};

export type SaleRecord = {
  id: string;
  item_id: string;
  sale_price_ore: Ore;
  seller_fee_ore: Ore;
  seller_paid_shipping_ore: Ore;
  direct_sale_cost_ore: Ore;
  refund_amount_ore: Ore;
  sale_date: string;
  selling_platform: string | null;
  net_sale_proceeds_ore: Ore;
  realized_profit_ore: Ore;
  profit_margin_bps: number | null;
  roi_bps: number | null;
  reinvestment_allocation_ore: Ore;
  reserve_allocation_ore: Ore;
  created_at: string;
};

export type LedgerTransaction = {
  id: string;
  type: TransactionType;
  envelope: Envelope;
  amount_ore: Ore;
  occurred_on: string;
  item_id: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};
