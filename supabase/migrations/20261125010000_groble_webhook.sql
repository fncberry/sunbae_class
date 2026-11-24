-- 5단계: 그로블 결제창 링크 + 웹훅 기록·처리
-- 가이드: https://www.groble.im/help/guides/webhook, /webhook-events, /payment-window
--
-- 1. lecture_checkout_links: 강의·구매 방식마다 그로블 결제창 링크 (운영자만 등록)
-- 2. payment_events: 웹훅 원본 기록. 서버(service_role)가 넣으면 트리거가 주문·수강권에 반영한다
--    - payment.completed: sellerReference(= 우리 주문 id) + 금액이 맞으면 결제 완료 + 수강권 발급
--    - payment.refunded: merchantUid로 주문을 찾아 환불 + 수강권 회수 (부분 환불은 운영자 확인)
--    - payment.cancel_requested: 운영자 확인 목록에 올린다
--    처리할 수 없는 건은 에러 대신 needs_review로 남긴다(그로블이 같은 실패를 계속 재전송하지 않게).

-- ─── 1. 결제창 링크 ───────────────────────────────────────

create table public.lecture_checkout_links (
  lecture_id text not null references public.lectures (id) on delete cascade,
  option public.purchase_option not null,
  url text not null check (url ~ '^https://(www\.)?groble\.im/[A-Za-z0-9/_.~%-]+$'),
  primary key (lecture_id, option)
);

alter table public.lecture_checkout_links enable row level security;

revoke all on public.lecture_checkout_links from anon, authenticated;
grant select, delete on public.lecture_checkout_links to authenticated;
grant insert (lecture_id, option, url), update (url) on public.lecture_checkout_links to authenticated;

create policy "로그인하면 조회" on public.lecture_checkout_links
  for select to authenticated using (true);
create policy "운영자만 등록" on public.lecture_checkout_links
  for insert to authenticated with check ((select private.is_admin()));
create policy "운영자만 수정" on public.lecture_checkout_links
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "운영자만 삭제" on public.lecture_checkout_links
  for delete to authenticated using ((select private.is_admin()));

-- ─── 2. 웹훅 기록 ─────────────────────────────────────────

create type public.payment_event_result as enum ('applied', 'duplicate', 'needs_review', 'ignored');

create table public.payment_events (
  id text primary key check (char_length(id) between 1 and 200), -- X-Groble-Idempotency-Key (없으면 봉투 id)
  event_id text,                                                 -- 봉투 id (evt_…)
  type text not null,
  merchant_uid text,                                             -- 그로블 결제번호
  order_id uuid references public.orders (id),
  payload jsonb not null,
  result public.payment_event_result not null default 'ignored',
  note text,
  occurred_at timestamptz,
  received_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id)
);

create index payment_events_open on public.payment_events (received_at desc)
  where result = 'needs_review' and resolved_at is null;
create index payment_events_order on public.payment_events (order_id);

alter table public.payment_events enable row level security;

-- 쓰기는 서버(service_role)만. 운영자는 보고 '확인함'만 표시한다
revoke all on public.payment_events from anon, authenticated;
grant select, update (resolved_at) on public.payment_events to authenticated;

create policy "운영자만 조회" on public.payment_events
  for select to authenticated using ((select private.is_admin()));
create policy "운영자만 확인 표시" on public.payment_events
  for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- 웹훅 반영. service_role이 넣을 때만 불린다(클라이언트에는 insert 권한이 없다)
create function private.apply_payment_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_obj jsonb := coalesce(new.payload -> 'data' -> 'object', '{}'::jsonb);
  v_ref text := nullif(btrim(v_obj ->> 'sellerReference'), '');
  v_amount integer;
  v_order public.orders%rowtype;
begin
  new.event_id := coalesce(new.event_id, new.payload ->> 'id');
  new.type := coalesce(nullif(new.type, ''), new.payload ->> 'type', 'unknown');
  new.merchant_uid := nullif(btrim(v_obj ->> 'merchantUid'), '');
  new.received_at := now();
  new.order_id := null;
  new.note := null;
  new.resolved_at := null;
  new.resolved_by := null;
  begin
    new.occurred_at := (new.payload ->> 'occurredAt')::timestamptz;
  exception when others then
    new.occurred_at := null;
  end;

  if new.type = 'payment.completed' then
    if v_ref is null or v_ref !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      new.result := 'needs_review';
      new.note := '우리 주문번호(ref)가 없는 결제예요.';
      return new;
    end if;

    select * into v_order from public.orders where id = v_ref::uuid for update;
    if not found then
      new.result := 'needs_review';
      new.note := '주문번호에 맞는 주문이 없어요.';
      return new;
    end if;
    new.order_id := v_order.id;

    if v_order.status = 'paid' and v_order.provider_order_id = new.merchant_uid then
      new.result := 'duplicate';
      return new;
    end if;
    if new.merchant_uid is null then
      new.result := 'needs_review';
      new.note := '그로블 결제번호(merchantUid)가 없어요.';
      return new;
    end if;
    if v_order.status <> 'pending' then
      new.result := 'needs_review';
      new.note := format('이미 %s 상태인 주문에 결제가 또 들어왔어요.', v_order.status);
      return new;
    end if;

    begin
      v_amount := (v_obj -> 'pricing' ->> 'finalAmount')::integer;
    exception when others then
      v_amount := null;
    end;
    if v_amount is distinct from v_order.amount then
      new.result := 'needs_review';
      new.note := format('결제 금액(%s원)이 주문 금액(%s원)과 달라요.', coalesce(v_amount::text, '?'), v_order.amount);
      return new;
    end if;

    begin
      update public.orders set status = 'paid', provider_order_id = new.merchant_uid where id = v_order.id;
      insert into public.enrollments (user_id, lecture_id, order_id, option)
      values (v_order.user_id, v_order.lecture_id, v_order.id, v_order.option);
      new.result := 'applied';
    exception when others then
      new.result := 'needs_review';
      new.note := '결제는 됐는데 수강권을 주지 못했어요: ' || sqlerrm;
    end;
    return new;
  end if;

  if new.type in ('payment.refunded', 'payment.cancel_requested') then
    if new.merchant_uid is not null then
      select * into v_order from public.orders where provider_order_id = new.merchant_uid for update;
      if found then
        new.order_id := v_order.id;
      end if;
    end if;

    if new.type = 'payment.cancel_requested' then
      new.result := 'needs_review';
      new.note := '환불 요청: ' || coalesce(left(btrim(v_obj -> 'cancelRequest' ->> 'detailReason'), 300), '사유 없음');
      return new;
    end if;

    if new.order_id is null then
      new.result := 'needs_review';
      new.note := '이 결제와 연결된 주문이 없어요.';
      return new;
    end if;
    if v_order.status = 'refunded' then
      new.result := 'duplicate';
      return new;
    end if;
    if coalesce((v_obj -> 'refund' ->> 'partialRefund')::boolean, false) then
      new.result := 'needs_review';
      new.note := format('부분 환불(%s원)이에요. 수강권은 그대로 두었어요.', coalesce(v_obj -> 'refund' ->> 'amount', '?'));
      return new;
    end if;
    if v_order.status <> 'paid' then
      new.result := 'needs_review';
      new.note := format('%s 상태인 주문의 환불이에요.', v_order.status);
      return new;
    end if;

    begin
      update public.orders set status = 'refunded' where id = v_order.id;
      update public.enrollments set revoked_at = now() where order_id = v_order.id and revoked_at is null;
      new.result := 'applied';
    exception when others then
      new.result := 'needs_review';
      new.note := '환불을 반영하지 못했어요: ' || sqlerrm;
    end;
    return new;
  end if;

  new.result := 'ignored';
  return new;
end;
$$;

create trigger payment_events_apply
  before insert on public.payment_events
  for each row execute function private.apply_payment_event();

-- 운영자 '확인함': 누가·언제는 서버가 채운다
create function private.guard_payment_event_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.resolved_at := case when new.resolved_at is null then null else coalesce(old.resolved_at, now()) end;
    new.resolved_by := case when new.resolved_at is null then null else coalesce(old.resolved_by, auth.uid()) end;
  end if;
  return new;
end;
$$;

create trigger payment_events_guard_update
  before update on public.payment_events
  for each row execute function private.guard_payment_event_update();

revoke execute on function private.apply_payment_event() from public, anon, authenticated;
revoke execute on function private.guard_payment_event_update() from public, anon, authenticated;
