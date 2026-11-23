-- Aplicado no projeto oohiwxfqrddeozdkjrwv (migrations jarvis_web_api e jarvis_has_owner).
create table if not exists jarvis.owner(
  id boolean primary key default true check (id),
  uid uuid not null,
  claimed_at timestamptz not null default now()
);
alter table jarvis.owner enable row level security;

create or replace function jarvis.is_owner() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from jarvis.owner o where o.uid = auth.uid())
$$;
revoke all on function jarvis.is_owner() from public, anon, authenticated;

create or replace function public.jarvis_has_owner() returns boolean
language sql stable security definer set search_path='' as $$ select exists(select 1 from jarvis.owner) $$;

create or replace function public.jarvis_claim() returns text
language plpgsql security definer set search_path='' as $$
declare u uuid := auth.uid(); cur uuid;
begin
  if u is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select o.uid into cur from jarvis.owner o where o.id;
  if cur is null then
    insert into jarvis.owner(id, uid) values (true, u) on conflict (id) do nothing;
    select o.uid into cur from jarvis.owner o where o.id;
  end if;
  return case when cur = u then 'owner' else 'denied' end;
end $$;

create or replace function public.jarvis_load() returns json
language plpgsql stable security definer set search_path='' as $$
begin
  if not jarvis.is_owner() then raise exception 'not_owner' using errcode = '42501'; end if;
  return json_build_object(
    'settings', (select coalesce(json_object_agg(s.key, s.value), '{}'::json) from jarvis.settings s where s.key <> 'auth'),
    'spaces',  (select coalesce(json_agg(x), '[]'::json) from jarvis.areas x where x.deleted_at is null),
    'tasks',   (select coalesce(json_agg(x), '[]'::json) from jarvis.tasks x where x.deleted_at is null),
    'events',  (select coalesce(json_agg(x), '[]'::json) from jarvis.events x where x.deleted_at is null),
    'txs',     (select coalesce(json_agg(x), '[]'::json) from jarvis.transactions x where x.deleted_at is null),
    'habits',  (select coalesce(json_agg(x), '[]'::json) from jarvis.habits x where x.deleted_at is null),
    'goals',   (select coalesce(json_agg(x), '[]'::json) from jarvis.goals x where x.deleted_at is null),
    'clients', (select coalesce(json_agg(x), '[]'::json) from jarvis.clients x where x.deleted_at is null)
  );
end $$;

create or replace function public.jarvis_exec(ops jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare op jsonb; t text; rec jsonb; cols text; upd text; n integer := 0;
begin
  if not jarvis.is_owner() then raise exception 'not_owner' using errcode = '42501'; end if;
  if jsonb_typeof(ops) <> 'array' or jsonb_array_length(ops) > 200 then raise exception 'bad_ops'; end if;
  for op in select value from jsonb_array_elements(ops) loop
    t := op->>'t';
    if t is null or t not in ('areas','tasks','events','transactions','habits','goals','clients') then
      raise exception 'bad_table: %', t;
    end if;
    if op->>'op' = 'upsert' then
      rec := op->'rec';
      if jsonb_typeof(rec) <> 'object' or coalesce(rec->>'id','') = '' then raise exception 'missing_id'; end if;
      select string_agg(format('%I', c.column_name), ',' order by c.ordinal_position),
             string_agg(format('%1$I=excluded.%1$I', c.column_name), ',' order by c.ordinal_position) filter (where c.column_name <> 'id')
        into cols, upd
        from information_schema.columns c
       where c.table_schema = 'jarvis' and c.table_name = t
         and rec ? c.column_name and c.column_name not in ('updated_at','deleted_at');
      execute format(
        'insert into jarvis.%1$I (%2$s) select %2$s from jsonb_populate_record(null::jarvis.%1$I, $1) on conflict (id) do update set %3$s',
        t, cols, concat_ws(',', nullif(upd, ''), 'updated_at=now()', 'deleted_at=null')
      ) using rec;
    elsif op->>'op' = 'delete' then
      execute format('update jarvis.%I set deleted_at = now(), updated_at = now() where id = $1', t) using (op->>'id');
    else
      raise exception 'bad_op';
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.jarvis_groq(payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if not jarvis.is_owner() then raise exception 'not_owner' using errcode = '42501'; end if;
  return jarvis.groq_chat(payload);
end $$;

revoke all on function public.jarvis_has_owner() from public;
revoke all on function public.jarvis_claim() from public, anon;
revoke all on function public.jarvis_load() from public, anon;
revoke all on function public.jarvis_exec(jsonb) from public, anon;
revoke all on function public.jarvis_groq(jsonb) from public, anon;
grant execute on function public.jarvis_has_owner() to anon, authenticated;
grant execute on function public.jarvis_claim() to authenticated;
grant execute on function public.jarvis_load() to authenticated;
grant execute on function public.jarvis_exec(jsonb) to authenticated;
grant execute on function public.jarvis_groq(jsonb) to authenticated;
