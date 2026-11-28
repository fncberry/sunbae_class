-- 7단계: 정산
-- 강사 몫은 결제 금액의 80%. 그로블 수수료는 운영 몫에서 부담한다.
-- 월 1회, 시험일이 지나 더는 환불될 수 없는 결제만 모아 정산한다(환불은 시험일까지).
-- 돈은 운영자가 계좌이체로 보내고, 사이트에는 정산 내역과 지급 기록만 남긴다.

-- ─── 받을 계좌 ────────────────────────────────────────────

create table public.instructor_payout_accounts (
  instructor_id text primary key references public.instructors (id) on delete cascade,
  bank text not null check (char_length(btrim(bank)) between 1 and 30),
  account_number text not null check (account_number ~ '^[0-9][0-9-]{4,28}[0-9]$'),
  holder text not null check (char_length(btrim(holder)) between 1 and 30),
  updated_at timestamptz not null default now()
);

alter table public.instructor_payout_accounts enable row level security;

revoke all on public.instructor_payout_accounts from anon, authenticated;
grant select on public.instructor_payout_accounts to authenticated;
grant insert (instructor_id, bank, account_number, holder) on public.instructor_payout_accounts to authenticated;
grant update (bank, account_number, holder) on public.instructor_payout_accounts to authenticated;

create policy "본인 또는 운영자 조회" on public.instructor_payout_accounts
  for select to authenticated
  using (instructor_id = (select private.my_instructor_id()) or (select private.is_admin()));

create policy "본인 계좌 등록" on public.instructor_payout_accounts
  for insert to authenticated
  with check (instructor_id = (select private.my_instructor_id()));

create policy "본인 계좌 수정" on public.instructor_payout_accounts
  for update to authenticated
  using (instructor_id = (select private.my_instructor_id()))
  with check (instructor_id = (select private.my_instructor_id()));

create function private.prepare_payout_account()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.bank := btrim(new.bank);
  new.holder := btrim(new.holder);
  new.account_number := btrim(new.account_number);
  new.updated_at := now();
  return new;
end;
$$;

create trigger instructor_payout_accounts_prepare
  before insert or update on public.instructor_payout_accounts
  for each row execute function private.prepare_payout_account();

-- ─── 정산 ─────────────────────────────────────────────────

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  instructor_id text not null references public.instructors (id),
  period text not null check (period ~ '^\d{4}-\d{2}$'), -- 만든 달 (한국 시간)
  cutoff_date date not null, -- 이 날짜 전에 시험이 끝난 결제만 담았다
  share_percent smallint not null check (share_percent between 1 and 100),
  order_count integer not null check (order_count > 0),
  gross_amount integer not null check (gross_amount > 0),
  payout_amount integer not null check (payout_amount >= 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  paid_at timestamptz,
  paid_by uuid references public.profiles (id) on delete set null,
  paid_to text -- 보낸 계좌 (지급 시점 기록)
);

create index settlements_instructor on public.settlements (instructor_id, created_at desc);
create index settlements_unpaid on public.settlements (created_at) where paid_at is null;
create index settlements_created_by on public.settlements (created_by);
create index settlements_paid_by on public.settlements (paid_by);

alter table public.orders add column settlement_id uuid references public.settlements (id) on delete set null;
create index orders_settlement on public.orders (settlement_id);
create index orders_unsettled on public.orders (lecture_id) where status = 'paid' and settlement_id is null;

alter table public.settlements enable row level security;

-- 운영자는 강사만 골라 만든다. 금액·주문은 트리거가 정한다. 수정은 지급 표시(paid_at)만
revoke all on public.settlements from anon, authenticated;
grant select, delete on public.settlements to authenticated;
grant insert (instructor_id) on public.settlements to authenticated;
grant update (paid_at) on public.settlements to authenticated;

create policy "본인 또는 운영자 조회" on public.settlements
  for select to authenticated
  using (instructor_id = (select private.my_instructor_id()) or (select private.is_admin()));

create policy "운영자만 정산 생성" on public.settlements
  for insert to authenticated
  with check ((select private.is_admin()));

create policy "운영자만 지급 표시" on public.settlements
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy "지급 전에만 운영자 취소" on public.settlements
  for delete to authenticated
  using ((select private.is_admin()) and paid_at is null);

-- 정산할 수 있는 결제를 잠그고 합계를 낸다 (운영자에게 주문 수정 권한이 없으므로 definer)
create function private.lock_settleable_orders(p_instructor_id text, p_cutoff date, out order_count integer, out gross_amount integer)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not private.is_admin() then
    raise exception '운영자만 정산할 수 있어요.' using errcode = 'P0001', hint = 'admin_only';
  end if;

  perform 1
  from public.orders o
  join public.lectures l on l.id = o.lecture_id
  join public.courses c on c.id = l.course_id
  where l.instructor_id = p_instructor_id and o.status = 'paid' and o.settlement_id is null and c.exam_date < p_cutoff
  for update of o;

  select count(*)::integer, coalesce(sum(o.amount), 0)::integer into order_count, gross_amount
  from public.orders o
  join public.lectures l on l.id = o.lecture_id
  join public.courses c on c.id = l.course_id
  where l.instructor_id = p_instructor_id and o.status = 'paid' and o.settlement_id is null and c.exam_date < p_cutoff;
end;
$$;

-- 정산에 담은 결제에 정산 id를 붙인다 (같은 결제가 두 번 정산되지 않게)
create function private.attach_settlement_orders(p_settlement_id uuid, p_instructor_id text, p_cutoff date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if (select auth.uid()) is not null and not private.is_admin() then
    raise exception '운영자만 정산할 수 있어요.' using errcode = 'P0001', hint = 'admin_only';
  end if;

  update public.orders o
  set settlement_id = p_settlement_id
  from public.lectures l, public.courses c
  where l.id = o.lecture_id and c.id = l.course_id
    and l.instructor_id = p_instructor_id and o.status = 'paid' and o.settlement_id is null and c.exam_date < p_cutoff;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function private.lock_settleable_orders(text, date) from public, anon;
revoke execute on function private.attach_settlement_orders(uuid, text, date) from public, anon;
grant execute on function private.lock_settleable_orders(text, date) to authenticated, service_role;
grant execute on function private.attach_settlement_orders(uuid, text, date) to authenticated, service_role;

create function private.prepare_settlement()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Asia/Seoul')::date;
  v_count integer;
  v_gross integer;
begin
  if current_user in ('authenticated', 'anon') then
    new.created_by := (select auth.uid());
  end if;
  new.share_percent := 80;
  new.cutoff_date := v_today;
  new.period := to_char(v_today, 'YYYY-MM');
  new.created_at := now();
  new.paid_at := null;
  new.paid_by := null;
  new.paid_to := null;

  select order_count, gross_amount into v_count, v_gross
  from private.lock_settleable_orders(new.instructor_id, new.cutoff_date);
  if v_count = 0 then
    raise exception '정산할 결제가 없어요.' using errcode = 'P0001', hint = 'nothing_to_settle';
  end if;

  new.order_count := v_count;
  new.gross_amount := v_gross;
  new.payout_amount := (v_gross::bigint * new.share_percent / 100)::integer;
  return new;
end;
$$;

create trigger settlements_prepare
  before insert on public.settlements
  for each row execute function private.prepare_settlement();

create function private.attach_settlement()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform private.attach_settlement_orders(new.id, new.instructor_id, new.cutoff_date);
  return null;
end;
$$;

create trigger settlements_attach
  after insert on public.settlements
  for each row execute function private.attach_settlement();

-- 지급 표시: 시각·처리자·보낸 계좌는 서버가 채운다. 지급한 정산은 되돌리지 않는다
create function private.guard_settlement_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_account public.instructor_payout_accounts%rowtype;
begin
  if (new.instructor_id, new.period, new.cutoff_date, new.share_percent, new.order_count, new.gross_amount, new.payout_amount, new.created_at)
     is distinct from
     (old.instructor_id, old.period, old.cutoff_date, old.share_percent, old.order_count, old.gross_amount, old.payout_amount, old.created_at) then
    raise exception '정산 내용은 바꿀 수 없어요.' using errcode = 'P0001', hint = 'settlement_immutable';
  end if;

  if current_user in ('authenticated', 'anon') then
    if old.paid_at is not null then
      raise exception '이미 지급한 정산이에요.' using errcode = 'P0001', hint = 'already_paid';
    end if;
    if new.paid_at is null then
      new.paid_by := null;
      new.paid_to := null;
      return new;
    end if;

    select * into v_account from public.instructor_payout_accounts where instructor_id = old.instructor_id;
    if not found then
      raise exception '강사가 받을 계좌를 아직 등록하지 않았어요.' using errcode = 'P0001', hint = 'no_account';
    end if;
    new.paid_at := now();
    new.paid_by := (select auth.uid());
    new.paid_to := v_account.bank || ' ' || v_account.account_number || ' ' || v_account.holder;
  end if;
  return new;
end;
$$;

create trigger settlements_guard_update
  before update on public.settlements
  for each row execute function private.guard_settlement_update();

revoke execute on function private.prepare_payout_account() from public, anon, authenticated;
revoke execute on function private.prepare_settlement() from public, anon, authenticated;
revoke execute on function private.attach_settlement() from public, anon, authenticated;
revoke execute on function private.guard_settlement_update() from public, anon, authenticated;
