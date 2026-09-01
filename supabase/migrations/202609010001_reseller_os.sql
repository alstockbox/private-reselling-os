create extension if not exists pgcrypto;

create table if not exists app_settings (
  id text primary key default 'owner',
  starting_capital_ore integer not null check (starting_capital_ore >= 0),
  reinvestment_percentage integer not null default 80 check (reinvestment_percentage between 0 and 100),
  reserve_percentage integer not null default 20 check (reserve_percentage between 0 and 100),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_settings_split_check check (reinvestment_percentage + reserve_percentage = 100)
);

create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  category text,
  brand text,
  size text,
  condition text,
  color text,
  sku text not null default ('SB-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  purchase_price_ore integer not null default 0 check (purchase_price_ore >= 0),
  inbound_shipping_ore integer not null default 0 check (inbound_shipping_ore >= 0),
  acquisition_fee_ore integer not null default 0 check (acquisition_fee_ore >= 0),
  other_acquisition_cost_ore integer not null default 0 check (other_acquisition_cost_ore >= 0),
  acquisition_cost_ore integer not null default 0 check (acquisition_cost_ore >= 0),
  purchase_date date not null default current_date,
  source_platform text,
  source_url text,
  source_notes text,
  listing_platform text,
  listing_url text,
  asking_price_ore integer check (asking_price_ore is null or asking_price_ore >= 0),
  listing_date date,
  listing_notes text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'ACTIVE', 'SOLD', 'RETURNED', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists sale_records (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null unique references inventory_items(id) on delete restrict,
  sale_price_ore integer not null check (sale_price_ore >= 0),
  seller_fee_ore integer not null default 0 check (seller_fee_ore >= 0),
  seller_paid_shipping_ore integer not null default 0 check (seller_paid_shipping_ore >= 0),
  direct_sale_cost_ore integer not null default 0 check (direct_sale_cost_ore >= 0),
  refund_amount_ore integer not null default 0 check (refund_amount_ore >= 0),
  sale_date date not null default current_date,
  selling_platform text,
  net_sale_proceeds_ore integer not null,
  realized_profit_ore integer not null,
  profit_margin_bps integer,
  roi_bps integer,
  reinvestment_allocation_ore integer not null default 0,
  reserve_allocation_ore integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in (
    'INITIAL_CAPITAL','PURCHASE','SALE_RETURN_CAPITAL','SALE_REINVESTMENT_PROFIT',
    'SALE_RESERVE_PROFIT','OPERATING_EXPENSE','DEPOSIT','WITHDRAWAL',
    'TRANSFER_TO_RESERVE','TRANSFER_TO_REINVESTMENT','REFUND','ADJUSTMENT'
  )),
  envelope text not null check (envelope in ('reinvestment', 'reserve')),
  amount_ore integer not null,
  occurred_on date not null default current_date,
  item_id uuid references inventory_items(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists inventory_items_status_idx on inventory_items(status);
create index if not exists inventory_items_created_at_idx on inventory_items(created_at desc);
create index if not exists ledger_transactions_occurred_on_idx on ledger_transactions(occurred_on desc);
create index if not exists sale_records_sale_date_idx on sale_records(sale_date desc);

alter table app_settings enable row level security;
alter table inventory_items enable row level security;
alter table sale_records enable row level security;
alter table ledger_transactions enable row level security;

create policy "service role only settings" on app_settings for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role only items" on inventory_items for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role only sales" on sale_records for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role only ledger" on ledger_transactions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
