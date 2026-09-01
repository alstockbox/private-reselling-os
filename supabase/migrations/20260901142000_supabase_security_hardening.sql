alter function complete_onboarding_tx(integer, integer, integer)
  set search_path = public, pg_temp;

alter function create_item_with_purchase_tx(
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  integer,
  integer,
  integer,
  integer,
  date,
  text,
  text,
  text,
  text,
  text,
  integer,
  date,
  text,
  text
) set search_path = public, pg_temp;

alter function mark_item_sold_tx(uuid, integer, integer, integer, integer, integer, date, text)
  set search_path = public, pg_temp;

drop policy if exists "server access app_settings" on app_settings;
drop policy if exists "server access inventory_items" on inventory_items;
drop policy if exists "server access sale_records" on sale_records;
drop policy if exists "server access ledger_transactions" on ledger_transactions;

create policy "server access app_settings" on app_settings
  for all to service_role using (true) with check (true);

create policy "server access inventory_items" on inventory_items
  for all to service_role using (true) with check (true);

create policy "server access sale_records" on sale_records
  for all to service_role using (true) with check (true);

create policy "server access ledger_transactions" on ledger_transactions
  for all to service_role using (true) with check (true);

create index if not exists ledger_transactions_item_id_idx on ledger_transactions(item_id);

do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;
