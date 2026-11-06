-- Run against a disposable database after fresh-install.sql.
\set ON_ERROR_STOP on
insert into auth.users(id) values
 ('11111111-1111-4111-8111-111111111111'),
 ('22222222-2222-4222-8222-222222222222'),
 ('33333333-3333-4333-8333-333333333333');
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',false);
select public.mvp_create_household('Synthetic A') as household_a \gset
select public.mvp_create_account('Synthetic account') as account_a \gset
do $$ begin
 if (select balance_cents from public.mvp_balances) is distinct from '0' then raise exception 'Expected zero'; end if;
end $$;
select public.mvp_post('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',:'account_a','income',20000);
select public.mvp_post('aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa',:'account_a','income',20000);
select public.mvp_post('bbbbbbbb-1111-4111-8111-bbbbbbbbbbbb',:'account_a','expense',5000);
do $$ begin
 if (select balance_cents from public.mvp_balances) is distinct from '15000' or (select count(*) from public.cash_entries) <> 2 then
  raise exception 'Expected two entries and BRL 150';
 end if;
 begin
  update public.household_members set role='owner';
  raise exception 'Direct membership write allowed';
 exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',false);
select public.mvp_create_household('Synthetic B');
select public.mvp_create_account('Synthetic account');
select set_config('test.other_account', :'account_a', false);
do $$ begin
 if (select count(*) from public.households) <> 1 or (select balance_cents from public.mvp_balances) is distinct from '0'
   or exists(select 1 from public.cash_entries) then raise exception 'Cross household read'; end if;
 begin
  perform public.mvp_post(gen_random_uuid(),current_setting('test.other_account')::uuid,'expense',1);
  raise exception 'Cross household post allowed';
 exception when insufficient_privilege then null; end;
end $$;

reset role;
insert into public.household_members values ('33333333-3333-4333-8333-333333333333', :'household_a', 'member');
set role authenticated;
select set_config('request.jwt.claim.sub','33333333-3333-4333-8333-333333333333',false);
do $$ begin
 if (select balance_cents from public.mvp_balances) is distinct from '15000' then raise exception 'Partner cannot see shared balance'; end if;
end $$;
reset role;
set role anon;
do $$ begin
 begin
  perform public.mvp_create_household('Anonymous');
  raise exception 'Anonymous onboarding allowed';
 exception when insufficient_privilege then null; end;
end $$;
select 'PASS: zero, BRL 150, retry, household isolation, partner, anonymous rejection' as result;
