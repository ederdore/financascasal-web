-- Install on a clean Supabase database with Auth already initialized.
begin;

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80)
);
create table public.household_members (
  user_id uuid primary key references auth.users(id),
  household_id uuid not null references public.households(id),
  role text not null check (role in ('owner', 'member'))
);
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id),
  name text not null check (length(trim(name)) between 1 and 80),
  unique (household_id, id),
  unique (household_id, name)
);
create table public.cash_entries (
  id uuid primary key,
  household_id uuid not null,
  account_id uuid not null,
  actor_id uuid not null references auth.users(id),
  kind text not null check (kind in ('income', 'expense')),
  amount_cents bigint not null check (amount_cents between 1 and 99999999999),
  created_at timestamptz not null default now(),
  foreign key (household_id, account_id) references public.bank_accounts(household_id, id)
);
create index cash_entries_household_account on public.cash_entries(household_id, account_id);

create function public.mvp_household() returns uuid
language sql stable security definer set search_path = '' as $$
  select household_id from public.household_members where user_id = auth.uid();
$$;

create function public.mvp_create_household(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); hid uuid;
begin
  if actor is null then raise exception 'Autenticação obrigatória'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text, 0));
  hid := public.mvp_household();
  if hid is not null then return hid; end if;
  insert into public.households(name) values(trim(p_name)) returning id into hid;
  insert into public.household_members values(actor, hid, 'owner');
  return hid;
end;
$$;

-- Partner assignment is an explicit administrator operation using verified Auth IDs.
-- No browser role can write memberships, including the household owner.
create function public.mvp_create_account(p_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare hid uuid := public.mvp_household(); aid uuid;
begin
  if hid is null then raise exception 'Household obrigatório'; end if;
  insert into public.bank_accounts(household_id, name) values(hid, trim(p_name))
    on conflict (household_id, name) do nothing returning id into aid;
  if aid is null then
    select id into aid from public.bank_accounts where household_id=hid and name=trim(p_name);
  end if;
  return aid;
end;
$$;

create function public.mvp_post(p_id uuid, p_account_id uuid, p_kind text, p_amount_cents bigint)
returns uuid language plpgsql security definer set search_path = '' as $$
declare hid uuid := public.mvp_household(); actor uuid := auth.uid(); saved public.cash_entries;
begin
  if hid is null or not exists (
    select 1 from public.bank_accounts where household_id=hid and id=p_account_id
  ) then raise exception 'Conta indisponível neste household' using errcode='42501'; end if;
  insert into public.cash_entries(id,household_id,account_id,actor_id,kind,amount_cents)
    values(p_id,hid,p_account_id,actor,p_kind,p_amount_cents) on conflict (id) do nothing;
  select * into saved from public.cash_entries where id=p_id;
  if (saved.household_id,saved.account_id,saved.actor_id,saved.kind,saved.amount_cents)
    is distinct from (hid,p_account_id,actor,p_kind,p_amount_cents) then
    raise exception 'Identificador de operação indisponível';
  end if;
  return p_id;
end;
$$;

create view public.mvp_balances with (security_invoker=true) as
  select a.id, a.name, coalesce(sum(case e.kind when 'income' then e.amount_cents
    when 'expense' then -e.amount_cents end),0)::text as balance_cents
  from public.bank_accounts a left join public.cash_entries e
    on e.household_id=a.household_id and e.account_id=a.id group by a.id,a.name;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.cash_entries enable row level security;
create policy household_read on public.households for select to authenticated using(id=(select public.mvp_household()));
create policy membership_read on public.household_members for select to authenticated using(user_id=(select auth.uid()));
create policy bank_read on public.bank_accounts for select to authenticated using(household_id=(select public.mvp_household()));
create policy cash_read on public.cash_entries for select to authenticated using(household_id=(select public.mvp_household()));
revoke all on public.households,public.household_members,public.bank_accounts,public.cash_entries,public.mvp_balances from public,anon,authenticated;
grant select on public.households,public.household_members,public.bank_accounts,public.cash_entries,public.mvp_balances to authenticated;
revoke all on function public.mvp_household(),public.mvp_create_household(text),public.mvp_create_account(text),public.mvp_post(uuid,uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.mvp_household(),public.mvp_create_household(text),public.mvp_create_account(text),public.mvp_post(uuid,uuid,text,bigint) to authenticated;
commit;
