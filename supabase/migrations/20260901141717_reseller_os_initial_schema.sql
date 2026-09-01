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

create or replace function complete_onboarding_tx(
  p_starting_capital_ore integer,
  p_reinvestment_percentage integer default 80,
  p_reserve_percentage integer default 20
)
returns void
language plpgsql
as $$
begin
  if p_starting_capital_ore < 0 then
    raise exception 'Starting capital must be non-negative';
  end if;

  if p_reinvestment_percentage < 0
    or p_reserve_percentage < 0
    or p_reinvestment_percentage + p_reserve_percentage <> 100 then
    raise exception 'Profit split must total 100';
  end if;

  insert into app_settings (
    id,
    starting_capital_ore,
    reinvestment_percentage,
    reserve_percentage,
    onboarding_completed,
    updated_at
  )
  values (
    'owner',
    p_starting_capital_ore,
    p_reinvestment_percentage,
    p_reserve_percentage,
    true,
    now()
  )
  on conflict (id) do update set
    starting_capital_ore = excluded.starting_capital_ore,
    reinvestment_percentage = excluded.reinvestment_percentage,
    reserve_percentage = excluded.reserve_percentage,
    onboarding_completed = true,
    updated_at = now();

  insert into ledger_transactions (type, envelope, amount_ore, occurred_on, note)
  select 'INITIAL_CAPITAL', 'reinvestment', p_starting_capital_ore, current_date, 'Startkapital'
  where not exists (
    select 1 from ledger_transactions where type = 'INITIAL_CAPITAL'
  );
end;
$$;

create or replace function create_item_with_purchase_tx(
  p_title text,
  p_description text,
  p_image_url text,
  p_category text,
  p_brand text,
  p_size text,
  p_condition text,
  p_color text,
  p_purchase_price_ore integer,
  p_inbound_shipping_ore integer,
  p_acquisition_fee_ore integer,
  p_other_acquisition_cost_ore integer,
  p_purchase_date date,
  p_source_platform text,
  p_source_url text,
  p_source_notes text,
  p_listing_platform text,
  p_listing_url text,
  p_asking_price_ore integer,
  p_listing_date date,
  p_listing_notes text,
  p_status text default 'DRAFT'
)
returns uuid
language plpgsql
as $$
declare
  v_item_id uuid;
  v_acquisition_cost_ore integer;
begin
  if trim(coalesce(p_title, '')) = '' then
    raise exception 'Title is required';
  end if;

  if p_purchase_price_ore < 0
    or p_inbound_shipping_ore < 0
    or p_acquisition_fee_ore < 0
    or p_other_acquisition_cost_ore < 0
    or coalesce(p_asking_price_ore, 0) < 0 then
    raise exception 'Money values must be non-negative';
  end if;

  v_acquisition_cost_ore :=
    p_purchase_price_ore +
    p_inbound_shipping_ore +
    p_acquisition_fee_ore +
    p_other_acquisition_cost_ore;

  insert into inventory_items (
    title,
    description,
    image_url,
    category,
    brand,
    size,
    condition,
    color,
    purchase_price_ore,
    inbound_shipping_ore,
    acquisition_fee_ore,
    other_acquisition_cost_ore,
    acquisition_cost_ore,
    purchase_date,
    source_platform,
    source_url,
    source_notes,
    listing_platform,
    listing_url,
    asking_price_ore,
    listing_date,
    listing_notes,
    status
  )
  values (
    trim(p_title),
    p_description,
    p_image_url,
    p_category,
    p_brand,
    p_size,
    p_condition,
    p_color,
    p_purchase_price_ore,
    p_inbound_shipping_ore,
    p_acquisition_fee_ore,
    p_other_acquisition_cost_ore,
    v_acquisition_cost_ore,
    p_purchase_date,
    p_source_platform,
    p_source_url,
    p_source_notes,
    p_listing_platform,
    p_listing_url,
    p_asking_price_ore,
    p_listing_date,
    p_listing_notes,
    p_status
  )
  returning id into v_item_id;

  insert into ledger_transactions (type, envelope, amount_ore, occurred_on, item_id, note)
  values ('PURCHASE', 'reinvestment', -v_acquisition_cost_ore, p_purchase_date, v_item_id, 'Inköp: ' || trim(p_title));

  return v_item_id;
end;
$$;

create or replace function mark_item_sold_tx(
  p_item_id uuid,
  p_sale_price_ore integer,
  p_seller_fee_ore integer default 0,
  p_seller_paid_shipping_ore integer default 0,
  p_direct_sale_cost_ore integer default 0,
  p_refund_amount_ore integer default 0,
  p_sale_date date default current_date,
  p_selling_platform text default null
)
returns uuid
language plpgsql
as $$
declare
  v_item inventory_items%rowtype;
  v_sale_id uuid;
  v_reinvestment_percentage integer;
  v_reserve_percentage integer;
  v_net_sale_proceeds_ore integer;
  v_realized_profit_ore integer;
  v_profit_margin_bps integer;
  v_roi_bps integer;
  v_reinvestment_profit_ore integer := 0;
  v_reserve_profit_ore integer := 0;
  v_metadata jsonb;
begin
  if p_sale_price_ore < 0
    or p_seller_fee_ore < 0
    or p_seller_paid_shipping_ore < 0
    or p_direct_sale_cost_ore < 0
    or p_refund_amount_ore < 0 then
    raise exception 'Money values must be non-negative';
  end if;

  select * into v_item from inventory_items where id = p_item_id for update;
  if not found then
    raise exception 'Item not found';
  end if;
  if v_item.status = 'SOLD' then
    raise exception 'Item is already sold';
  end if;

  select reinvestment_percentage, reserve_percentage
    into v_reinvestment_percentage, v_reserve_percentage
  from app_settings
  where id = 'owner';

  if v_reinvestment_percentage is null then
    raise exception 'App settings are missing';
  end if;

  if v_reinvestment_percentage + v_reserve_percentage <> 100 then
    raise exception 'Profit split must total 100';
  end if;

  v_net_sale_proceeds_ore :=
    p_sale_price_ore -
    p_seller_fee_ore -
    p_seller_paid_shipping_ore -
    p_direct_sale_cost_ore -
    p_refund_amount_ore;

  v_realized_profit_ore := v_net_sale_proceeds_ore - v_item.acquisition_cost_ore;

  if p_sale_price_ore > 0 then
    v_profit_margin_bps := round((v_realized_profit_ore::numeric / p_sale_price_ore::numeric) * 10000);
  end if;

  if v_item.acquisition_cost_ore > 0 then
    v_roi_bps := round((v_realized_profit_ore::numeric / v_item.acquisition_cost_ore::numeric) * 10000);
  end if;

  if v_realized_profit_ore > 0 then
    v_reserve_profit_ore := round((v_realized_profit_ore::numeric * v_reserve_percentage::numeric) / 100);
    v_reinvestment_profit_ore := v_realized_profit_ore - v_reserve_profit_ore;
  end if;

  v_metadata := jsonb_build_object(
    'acquisitionCostOre', v_item.acquisition_cost_ore,
    'netSaleProceedsOre', v_net_sale_proceeds_ore,
    'realizedProfitOre', v_realized_profit_ore,
    'reinvestmentProfitOre', v_reinvestment_profit_ore,
    'reserveProfitOre', v_reserve_profit_ore
  );

  insert into sale_records (
    item_id,
    sale_price_ore,
    seller_fee_ore,
    seller_paid_shipping_ore,
    direct_sale_cost_ore,
    refund_amount_ore,
    sale_date,
    selling_platform,
    net_sale_proceeds_ore,
    realized_profit_ore,
    profit_margin_bps,
    roi_bps,
    reinvestment_allocation_ore,
    reserve_allocation_ore
  )
  values (
    v_item.id,
    p_sale_price_ore,
    p_seller_fee_ore,
    p_seller_paid_shipping_ore,
    p_direct_sale_cost_ore,
    p_refund_amount_ore,
    p_sale_date,
    coalesce(p_selling_platform, v_item.listing_platform),
    v_net_sale_proceeds_ore,
    v_realized_profit_ore,
    v_profit_margin_bps,
    v_roi_bps,
    v_reinvestment_profit_ore,
    v_reserve_profit_ore
  )
  returning id into v_sale_id;

  if v_realized_profit_ore > 0 then
    insert into ledger_transactions (type, envelope, amount_ore, occurred_on, item_id, note, metadata)
    values ('SALE_RETURN_CAPITAL', 'reinvestment', v_item.acquisition_cost_ore, p_sale_date, v_item.id, 'Kapital tillbaka: ' || v_item.title, v_metadata);

    if v_reinvestment_profit_ore > 0 then
      insert into ledger_transactions (type, envelope, amount_ore, occurred_on, item_id, note, metadata)
      values ('SALE_REINVESTMENT_PROFIT', 'reinvestment', v_reinvestment_profit_ore, p_sale_date, v_item.id, 'Återinvesterad vinst: ' || v_item.title, v_metadata);
    end if;
  else
    insert into ledger_transactions (type, envelope, amount_ore, occurred_on, item_id, note, metadata)
    values ('SALE_RETURN_CAPITAL', 'reinvestment', v_net_sale_proceeds_ore, p_sale_date, v_item.id, 'Såld: ' || v_item.title, v_metadata);
  end if;

  if v_reserve_profit_ore > 0 then
    insert into ledger_transactions (type, envelope, amount_ore, occurred_on, item_id, note, metadata)
    values ('SALE_RESERVE_PROFIT', 'reserve', v_reserve_profit_ore, p_sale_date, v_item.id, 'Buffert från ' || v_item.title, v_metadata);
  end if;

  update inventory_items
    set status = 'SOLD',
        listing_platform = coalesce(p_selling_platform, listing_platform),
        updated_at = now()
    where id = v_item.id;

  return v_sale_id;
end;
$$;

alter table app_settings enable row level security;
alter table inventory_items enable row level security;
alter table sale_records enable row level security;
alter table ledger_transactions enable row level security;

revoke all on app_settings from anon, authenticated;
revoke all on inventory_items from anon, authenticated;
revoke all on sale_records from anon, authenticated;
revoke all on ledger_transactions from anon, authenticated;

grant select, insert, update, delete on app_settings to service_role;
grant select, insert, update, delete on inventory_items to service_role;
grant select, insert, update, delete on sale_records to service_role;
grant select, insert, update, delete on ledger_transactions to service_role;

revoke execute on function complete_onboarding_tx(integer, integer, integer) from public, anon, authenticated;
revoke execute on function create_item_with_purchase_tx(text, text, text, text, text, text, text, text, integer, integer, integer, integer, date, text, text, text, text, text, integer, date, text, text) from public, anon, authenticated;
revoke execute on function mark_item_sold_tx(uuid, integer, integer, integer, integer, integer, date, text) from public, anon, authenticated;

grant execute on function complete_onboarding_tx(integer, integer, integer) to service_role;
grant execute on function create_item_with_purchase_tx(text, text, text, text, text, text, text, text, integer, integer, integer, integer, date, text, text, text, text, text, integer, date, text, text) to service_role;
grant execute on function mark_item_sold_tx(uuid, integer, integer, integer, integer, integer, date, text) to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'item-images',
  'item-images',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
