// 선배클래스 마이그레이션 + 시드 + RLS 시나리오 검증 (PGlite)
// 실행: npm run db:test  (Docker 없이 PGlite로 supabase/migrations 전체 + seed.sql 적용 후 시나리오 검증)
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const root = new URL("../supabase/", import.meta.url);
const migrationsDir = new URL("migrations/", root);
const migrationFiles = readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
const db = new PGlite();

// Supabase 환경 흉내: 역할, auth 스키마, auth.uid(), 기본 권한
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

  -- Supabase Storage 흉내: 버킷·객체 테이블, 경로 함수. 실제처럼 objects에 RLS가 켜져 있다
  create schema storage;
  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null, owner uuid, created_at timestamptz default now(),
    unique (bucket_id, name)
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
  create function storage.extension(name text) returns text language sql immutable as $$
    select split_part(name, '.', -1)
  $$;
  grant usage on schema storage to anon, authenticated, service_role;
  grant all on storage.objects to anon, authenticated, service_role;
  grant select on storage.buckets to anon, authenticated, service_role;
`);

for (const f of migrationFiles) await db.exec(readFileSync(new URL(f, migrationsDir), "utf8"));
await db.exec(readFileSync(new URL("seed.sql", root), "utf8"));
console.log("✓ 마이그레이션 + 시드 적용");

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.log(`  ✗ ${name} ${detail}`); }
};

async function as(role, uid, sql, params) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  if (role !== "postgres") await db.exec(`set role ${role}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec("reset role");
  }
}
async function rejects(role, uid, sql, params) {
  try { await as(role, uid, sql, params); return false; } catch (e) { return e.message; }
}
const one = async (role, uid, sql, params) => (await as(role, uid, sql, params)).rows[0];

const S1 = "11111111-1111-1111-1111-111111111111"; // 학생
const S2 = "22222222-2222-2222-2222-222222222222"; // 다른 학생
const T1 = "33333333-3333-3333-3333-333333333333"; // 강사가 될 학생
const A1 = "44444444-4444-4444-4444-444444444444"; // 운영자

console.log("\n[시드 데이터]");
check("과목 17개", (await one("anon", null, "select count(*)::int n from courses")).n === 17);
check("판매 중 강의 12개 (anon)", (await one("anon", null, "select count(*)::int n from lectures")).n === 12);
check("챕터 62개", (await one("anon", null, "select count(*)::int n from chapters")).n === 62);
const ds = await one("anon", null, "select sales_count, review_count, rating_sum, study_group_taken from lectures where id='ds-final-tree-graph'");
check("카운터 시드값 유지 (판매 112, 후기 38, 스터디 11명)", ds.sales_count === 112 && ds.review_count === 38 && ds.study_group_taken === 11, JSON.stringify(ds));
check("후기 4개", (await one("anon", null, "select count(*)::int n from reviews")).n === 4);

console.log("\n[익명 사용자]");
check("승인된 인증만 보임 (12개)", (await one("anon", null, "select count(*)::int n from grade_verifications")).n === 12);

console.log("\n[전공·교양 구분]");
const tracks = await one("anon", null, "select count(*) filter (where track = 'major')::int major, count(*) filter (where track = 'liberal')::int liberal, count(*) filter (where kind = 'cert' and track is null)::int cert from courses");
check("전공 10개, 교양 4개, 자격증은 구분 없음 3개", tracks.major === 10 && tracks.liberal === 4 && tracks.cert === 3, JSON.stringify(tracks));
check("대학 수업인데 전공/교양이 없으면 거부", !!(await rejects("postgres", null, "insert into courses (id, kind, code, name, professor, semester, group_name, exam_date, exam_label) values ('x1','major','X','x','x','x','x','2026-12-01','기말고사')")));
check("자격증에 전공/교양을 붙이면 거부", !!(await rejects("postgres", null, "insert into courses (id, kind, name, track, group_name, exam_date, exam_label) values ('x2','cert','x','liberal','x','2026-12-01','시험')")));
check("profiles 안 보임", (await one("anon", null, "select count(*)::int n from profiles")).n === 0);
check("orders 조회 불가", !!(await rejects("anon", null, "select * from orders")) || (await one("anon", null, "select count(*)::int n from orders")).n === 0);
check("강의 직접 추가 불가", !!(await rejects("anon", null, "insert into lectures (id, course_id, instructor_id, title, price) values ('x','cose213','jung','x',1000)")));

console.log("\n[학교 이메일 제한]");
check("다른 도메인 가입 불가", !!(await rejects("postgres", null, "insert into auth.users (id, email) values (gen_random_uuid(), 'a@gmail.com')")));
check("비슷한 도메인 가입 불가", !!(await rejects("postgres", null, "insert into auth.users (id, email) values (gen_random_uuid(), 'a@fakekorea.ac.kr')")));
check("하위 도메인 가입 불가", !!(await rejects("postgres", null, "insert into auth.users (id, email) values (gen_random_uuid(), 'a@mail.korea.ac.kr')")));
check("이메일 없는 가입 불가", !!(await rejects("postgres", null, "insert into auth.users (id, email) values (gen_random_uuid(), null)")));

console.log("\n[가입 + 프로필]");
await as("postgres", null, `insert into auth.users (id, email) values ($1,'s1@korea.ac.kr'),($2,'s2@korea.ac.kr'),($3,'t1@Korea.AC.kr'),($4,'a1@korea.ac.kr')`, [S1, S2, T1, A1]);
check("학교 이메일을 다른 도메인으로 변경 불가", !!(await rejects("postgres", null, "update auth.users set email='s1@gmail.com' where id=$1", [S1])));
check("대소문자 섞인 학교 이메일 허용", (await one("postgres", null, "select count(*)::int n from auth.users where email='t1@Korea.AC.kr'")).n === 1);
check("가입 시 profiles 자동 생성", (await one("postgres", null, "select count(*)::int n from profiles")).n === 4);
await as("postgres", null, "update profiles set role='admin' where id=$1", [A1]);
check("본인 프로필만 보임", (await one("authenticated", S1, "select count(*)::int n from profiles")).n === 1);
check("운영자는 전체 프로필 보임", (await one("authenticated", A1, "select count(*)::int n from profiles")).n === 4);
check("학번 수정 가능", (await as("authenticated", S1, "update profiles set student_id='2026123412' where id=$1 returning id", [S1])).rows.length === 1);
check("역할(role) 셀프 변경 불가", !!(await rejects("authenticated", S1, "update profiles set role='admin' where id=$1", [S1])));
check("남의 학번 수정 안 됨", (await as("authenticated", S1, "update profiles set student_id='x' where id=$1 returning id", [S2])).rows.length === 0);

console.log("\n[결제·수강권]");
check("학생이 수강권 직접 발급 불가", !!(await rejects("authenticated", S1, "insert into enrollments (user_id, lecture_id, option) values ($1,'ds-final-tree-graph','video')", [S1])));
check("학생이 주문 직접 생성 불가", !!(await rejects("authenticated", S1, "insert into orders (user_id, lecture_id, option, amount) values ($1,'ds-final-tree-graph','video',1)", [S1])));
// 웹훅(service_role)이 결제 완료 처리
const order = await one("service_role", null, "insert into orders (user_id, lecture_id, option, amount, status, provider_order_id, paid_at) values ($1,'ds-final-tree-graph','study',14900,'paid','groble-1',now()) returning id", [S1]);
await as("service_role", null, "insert into enrollments (user_id, lecture_id, order_id, option) values ($1,'ds-final-tree-graph',$2,'study')", [S1, order.id]);
const ds2 = await one("anon", null, "select sales_count, study_group_taken from lectures where id='ds-final-tree-graph'");
check("수강권 발급 → 판매 113, 스터디 12명", ds2.sales_count === 113 && ds2.study_group_taken === 12, JSON.stringify(ds2));
check("본인 주문만 보임", (await one("authenticated", S1, "select count(*)::int n from orders")).n === 1 && (await one("authenticated", S2, "select count(*)::int n from orders")).n === 0);
check("본인 수강권만 보임", (await one("authenticated", S2, "select count(*)::int n from enrollments")).n === 0);
// 환불
await as("service_role", null, "update enrollments set revoked_at=now() where user_id=$1", [S1]);
const ds3 = await one("anon", null, "select sales_count, study_group_taken from lectures where id='ds-final-tree-graph'");
check("환불 → 카운터 원복", ds3.sales_count === 112 && ds3.study_group_taken === 11, JSON.stringify(ds3));
await as("service_role", null, "update enrollments set revoked_at=null where user_id=$1", [S1]);

// 스터디반 정원
await as("postgres", null, "update lectures set study_group_taken = study_group_capacity where id='calc-integration'");
check("스터디반 정원 초과 시 발급 거부", !!(await rejects("service_role", null, "insert into enrollments (user_id, lecture_id, option) values ($1,'calc-integration','study')", [S2])));
check("스터디반 없는 강의에 study 발급 거부", !!(await rejects("service_role", null, "insert into enrollments (user_id, lecture_id, option) values ($1,'phys-rotation','study')", [S2])));

console.log("\n[후기]");
await as("postgres", null, "update profiles set name='수강생', nickname='수강생1', major='컴퓨터학과', terms_agreed_at=now(), onboarded_at=now() where id=$1", [S1]);
{
  const mine = await one("authenticated", S1, "insert into reviews (lecture_id, rating, body) values ('ds-final-tree-graph',5,'  좋아요  ') returning user_id, author_label, body");
  check("수강생 후기: 작성자·표시 이름은 트리거가 채움", mine.user_id === S1 && mine.author_label === "컴퓨터학과 26학번" && mine.body === "좋아요", JSON.stringify(mine));
  const ds4 = await one("anon", null, "select review_count, rating_sum from lectures where id='ds-final-tree-graph'");
  check("후기 카운터 +1", ds4.review_count === 39 && ds4.rating_sum === 191, JSON.stringify(ds4));
  check("작성자를 직접 정할 수 없음", !!(await rejects("authenticated", S1, "insert into reviews (lecture_id, user_id, rating, body) values ('calc-integration',$1,5,'x')", [S1])));
  check("표시 이름을 직접 정할 수 없음", !!(await rejects("authenticated", S1, "insert into reviews (lecture_id, author_label, rating, body) values ('calc-integration','운영자',5,'x')")));
  check("수강 안 한 강의는 후기 작성 불가", !!(await rejects("authenticated", S1, "insert into reviews (lecture_id, rating, body) values ('calc-integration',5,'x')")));
  check("온보딩 전에는 후기 작성 불가", !!(await rejects("authenticated", S2, "insert into reviews (lecture_id, rating, body) values ('ds-final-tree-graph',1,'x')")));
  check("한 강의에 후기는 하나", !!(await rejects("authenticated", S1, "insert into reviews (lecture_id, rating, body) values ('ds-final-tree-graph',4,'또')")));
  check("빈 후기 거부", !!(await rejects("authenticated", S1, "update reviews set body='   ' where user_id=$1", [S1])));
  check("1000자 넘는 후기 거부", !!(await rejects("authenticated", S1, "update reviews set body=repeat('가', 1001) where user_id=$1", [S1])));
  await as("authenticated", S1, "update reviews set body='고쳤어요', rating=4 where user_id=$1", [S1]);
  const edited = await one("postgres", null, "select body, rating, author_label from reviews where user_id=$1", [S1]);
  const ds5 = await one("anon", null, "select review_count, rating_sum from lectures where id='ds-final-tree-graph'");
  check("후기 수정: 본문·별점만 바뀌고 카운터 반영", edited.body === "고쳤어요" && edited.rating === 4 && edited.author_label === "컴퓨터학과 26학번" && ds5.review_count === 39 && ds5.rating_sum === 190, JSON.stringify({ edited, ds5 }));
  check("남의 후기 수정 안 됨", (await as("authenticated", S2, "update reviews set body='x' where user_id=$1 returning id", [S1])).rows.length === 0);
}

console.log("\n[주문]");
const P1 = "55555555-5555-5555-5555-555555555555"; // 구매자
const P2 = "66666666-6666-6666-6666-666666666666"; // 온보딩 전
await as("postgres", null, "insert into auth.users (id, email) values ($1,'p1@korea.ac.kr'),($2,'p2@korea.ac.kr')", [P1, P2]);
await as("postgres", null, "update profiles set name='구매자', nickname='구매자1', student_id='2025990001', major='경영학과', terms_agreed_at=now(), onboarded_at=now() where id=$1", [P1]);
{
  const order = (uid, lecture, option) => one("authenticated", uid, "insert into orders (lecture_id, option) values ($1, $2) returning id, user_id, amount, status, provider", [lecture, option]);
  const price = await one("postgres", null, "select price, study_group_price from lectures where id='ds-final-tree-graph'");
  check("온보딩 전에는 주문 불가", !!(await rejects("authenticated", P2, "insert into orders (lecture_id, option) values ('ds-final-tree-graph','video')")));
  const o1 = await order(P1, "ds-final-tree-graph", "video");
  check("주문자·금액·상태는 서버가 정함", o1.user_id === P1 && o1.amount === price.price && o1.status === "pending" && o1.provider === "groble", JSON.stringify(o1));
  check("스터디반 주문은 스터디반 가격", (await order(P1, "ds-final-tree-graph", "study")).amount === price.study_group_price);
  check("금액을 직접 정해서 주문 불가", !!(await rejects("authenticated", P1, "insert into orders (lecture_id, option, amount) values ('ds-final-tree-graph','video',1)")));
  check("남의 이름으로 주문 불가", !!(await rejects("authenticated", P1, "insert into orders (lecture_id, option, user_id) values ('ds-final-tree-graph','video',$1)", [P2])));
  check("결제 완료 상태로 주문 생성 불가", !!(await rejects("authenticated", P1, "insert into orders (lecture_id, option, status) values ('ds-final-tree-graph','video','paid')")));
  check("스터디반 없는 강의는 스터디반 주문 불가", !!(await rejects("authenticated", P1, "insert into orders (lecture_id, option) values ('phys-rotation','study')")));
  check("정원 찬 스터디반 주문 불가", !!(await rejects("authenticated", P1, "insert into orders (lecture_id, option) values ('calc-integration','study')")));
  await as("postgres", null, "insert into lectures (id, course_id, instructor_id, title, price, status) values ('hidden-x','cose213','jung','판매 멈춘 강의',3000,'hidden')");
  check("판매 중이 아닌 강의는 주문 불가", !!(await rejects("authenticated", P1, "insert into orders (lecture_id, option) values ('hidden-x','video')")));
  check("이미 수강 중이면 주문 불가", !!(await rejects("authenticated", S1, "insert into orders (lecture_id, option) values ('ds-final-tree-graph','video')")));
  check("남의 주문은 안 보임", (await one("authenticated", P2, "select count(*)::int n from orders")).n === 0);
  check("학생이 결제 완료로 바꿀 수 없음", !!(await rejects("authenticated", P1, "update orders set status='paid' where id=$1", [o1.id])));

  // 웹훅(service_role): 결제 완료 → 수강권
  await as("service_role", null, "update orders set status='paid', provider_order_id='groble-p1' where id=$1", [o1.id]);
  check("결제 완료 시각 기록", (await one("postgres", null, "select paid_at from orders where id=$1", [o1.id])).paid_at !== null);
  check("결제된 주문을 대기로 되돌릴 수 없음", !!(await rejects("service_role", null, "update orders set status='pending' where id=$1", [o1.id])));
  check("주문 금액은 바꿀 수 없음", !!(await rejects("service_role", null, "update orders set amount=1 where id=$1", [o1.id])));
  await as("service_role", null, "insert into enrollments (user_id, lecture_id, order_id, option) values ($1,'ds-final-tree-graph',$2,'video')", [P1, o1.id]);
  check("같은 강의 수강권은 하나만", !!(await rejects("service_role", null, "insert into enrollments (user_id, lecture_id, option) values ($1,'ds-final-tree-graph','video')", [P1])));
  check("같은 주문으로 수강권 두 번 발급 불가", !!(await rejects("service_role", null, "insert into enrollments (user_id, lecture_id, order_id, option) values ($1,'calc-integration',$2,'video')", [P1, o1.id])));

  // 환불 → 재구매
  await as("service_role", null, "update orders set status='refunded' where id=$1", [o1.id]);
  await as("service_role", null, "update enrollments set revoked_at=now() where order_id=$1", [o1.id]);
  check("환불 시각 기록", (await one("postgres", null, "select refunded_at from orders where id=$1", [o1.id])).refunded_at !== null);
  check("환불된 주문은 다시 결제 완료로 못 바꿈", !!(await rejects("service_role", null, "update orders set status='paid' where id=$1", [o1.id])));
  const o3 = await order(P1, "ds-final-tree-graph", "video");
  check("환불 뒤 다시 주문 가능", o3.status === "pending");
  await as("service_role", null, "update orders set status='paid' where id=$1", [o3.id]);
  await as("service_role", null, "insert into enrollments (user_id, lecture_id, order_id, option) values ($1,'ds-final-tree-graph',$2,'video')", [P1, o3.id]);
  const hist = await one("postgres", null, "select count(*)::int total, count(*) filter (where revoked_at is null)::int active from enrollments where user_id=$1 and lecture_id='ds-final-tree-graph'", [P1]);
  check("재구매하면 새 수강권, 이전 기록은 남음", hist.total === 2 && hist.active === 1, JSON.stringify(hist));

  // 스터디반 정원: 되살리거나 옵션을 바꿀 때도 확인
  await as("service_role", null, "insert into enrollments (user_id, lecture_id, option) values ($1,'acct-statement','study')", [P1]);
  await as("service_role", null, "update enrollments set revoked_at=now() where user_id=$1 and lecture_id='acct-statement'", [P1]);
  await as("postgres", null, "update lectures set study_group_taken = study_group_capacity where id='acct-statement'");
  check("정원이 차면 환불된 스터디반 수강권을 되살릴 수 없음", !!(await rejects("service_role", null, "update enrollments set revoked_at=null where user_id=$1 and lecture_id='acct-statement'", [P1])));
  await as("service_role", null, "insert into enrollments (user_id, lecture_id, option) values ($1,'acct-statement','video')", [P1]);
  check("정원이 차면 영상 수강권을 스터디반으로 바꿀 수 없음", !!(await rejects("service_role", null, "update enrollments set option='study' where user_id=$1 and lecture_id='acct-statement' and revoked_at is null", [P1])));
  check("이미 자리를 차지한 스터디반 수강권은 다시 세지 않음", (await as("service_role", null, "update enrollments set revoked_at=null where user_id=$1 and lecture_id='ds-final-tree-graph' and revoked_at is null returning id", [S1])).rows.length === 1);

  // 판매를 멈춘 강의
  await as("service_role", null, "insert into enrollments (user_id, lecture_id, option) values ($1,'hidden-x','video')", [P1]);
  check("판매를 멈춘 강의도 수강생은 봄", (await one("authenticated", P1, "select count(*)::int n from lectures where id='hidden-x'")).n === 1);
  check("수강생이 아니면 판매 멈춘 강의 안 보임", (await one("authenticated", P2, "select count(*)::int n from lectures where id='hidden-x'")).n === 0 && (await one("anon", null, "select count(*)::int n from lectures where id='hidden-x'")).n === 0);
}

console.log("\n[공개 컬럼]");
check("익명은 후기 작성자 id를 못 봄", !!(await rejects("anon", null, "select user_id from reviews")));
check("익명은 강사 계정 id를 못 봄", !!(await rejects("anon", null, "select user_id from instructors")));
check("익명은 인증 처리자·캡처 경로를 못 봄", !!(await rejects("anon", null, "select reviewed_by from grade_verifications")) && !!(await rejects("anon", null, "select proof_path from grade_verifications")));
check("익명도 공개 컬럼은 읽음", (await one("anon", null, "select count(id)::int n from instructors")).n > 0 && (await one("anon", null, "select count(author_label)::int n from reviews")).n > 0);

console.log("\n[강사 지원 → 인증 → 강의 올리기]");
// 강사 지원은 가입 마무리(온보딩)를 끝낸 사람만. 이 테스트에서는 SQL로 바로 마친 상태로 둔다
check("온보딩 전에는 강사 프로필 못 만듦", !!(await rejects("authenticated", T1, "insert into instructors (user_id) values ($1)", [T1])));
await as("postgres", null, "update profiles set name='김강사', nickname='알고선배', student_id='2024320099', major='컴퓨터학과', terms_agreed_at=now(), onboarded_at=now() where id=$1", [T1]);
check("이름·학과를 직접 정해서 강사 프로필 못 만듦", !!(await rejects("authenticated", T1, "insert into instructors (user_id, name, major) values ($1,'정하윤','의예과')", [T1])));
const t1Inst = await one("authenticated", T1, "insert into instructors (user_id, bio) values ($1, ' 알고리즘 A+ ') returning id, name, major, admission_year, bio", [T1]);
check("강사 이름은 닉네임, 학과·학번은 프로필에서", t1Inst.name === "알고선배" && t1Inst.major === "컴퓨터학과" && t1Inst.admission_year === 24 && t1Inst.bio === "알고리즘 A+", JSON.stringify(t1Inst));
// 아래 시나리오를 읽기 쉽게 id를 't1'로 바꿔 둔다 (운영자 SQL)
await as("postgres", null, "update instructors set id='t1' where user_id=$1", [T1]);
check("강사 프로필은 한 사람당 하나", !!(await rejects("authenticated", T1, "insert into instructors (user_id) values ($1)", [T1])));
check("남의 user_id로 강사 프로필 생성 불가", !!(await rejects("authenticated", S2, "insert into instructors (user_id) values ($1)", [T1])));
check("강사는 소개만 고칠 수 있음", !!(await rejects("authenticated", T1, "update instructors set name='운영진' where id='t1'")) && (await as("authenticated", T1, "update instructors set bio='새 소개' where id='t1' returning id")).rows.length === 1);
check("인증 전에는 강의 못 올림", !!(await rejects("authenticated", T1, "insert into lectures (id, course_id, instructor_id, title, price, status) values ('t1-algo','cose214','t1','알고리즘 정리',5900,'reviewing')")));
// 캡처를 본인 폴더에 먼저 올리고, 그 파일 이름(신청 id)으로 신청한다
const V1 = "aaaaaaaa-0000-4000-8000-000000000001";
await as("authenticated", T1, "insert into storage.objects (bucket_id, name, owner) values ('grade-proofs', $1, $2)", [`${T1}/${V1}.png`, T1]);
check("캡처 없이 신청 불가", !!(await rejects("authenticated", T1, "insert into grade_verifications (id, instructor_id, course_id, grade, semester_label) values (gen_random_uuid(),'t1','cose214','A+','2025-2학기')")));
await as("authenticated", T1, "insert into grade_verifications (id, instructor_id, course_id, grade, semester_label, proof_path) values ($1,'t1','cose214','A+','2025-2학기',$2)", [V1, `${T1}/${V1}.png`]);
check("신청은 pending으로 생성", (await one("authenticated", T1, "select status from grade_verifications where instructor_id='t1'")).status === "pending");
check("신청자가 직접 승인 불가", !!(await rejects("authenticated", T1, "update grade_verifications set status='approved' where instructor_id='t1'")) || (await as("authenticated", T1, "update grade_verifications set status='approved' where instructor_id='t1' returning id")).rows.length === 0);
check("남의 강사 프로필로 신청 불가", !!(await rejects("authenticated", S2, "insert into grade_verifications (instructor_id, course_id, grade, semester_label) values ('t1','cose213','A+','x')")));
check("pending 신청은 익명에게 안 보임", (await one("anon", null, "select count(*)::int n from grade_verifications where instructor_id='t1'")).n === 0);
check("운영자는 대기열 6건 확인", (await one("authenticated", A1, "select count(*)::int n from grade_verifications where status='pending'")).n === 6);
check("처리자·처리 시각은 직접 못 씀", !!(await rejects("authenticated", A1, "update grade_verifications set reviewed_by=$1 where instructor_id='t1'", [A1])));
check("인증 문구 없이 승인 불가", !!(await rejects("authenticated", A1, "update grade_verifications set status='approved' where instructor_id='t1'")));
await as("authenticated", A1, "update grade_verifications set status='approved', proof_text='2025년 2학기 알고리즘 A+ 확인' where instructor_id='t1'");
const v1 = await one("postgres", null, "select reviewed_by, reviewed_at from grade_verifications where id=$1", [V1]);
check("승인하면 처리자·처리 시각이 기록됨", v1.reviewed_by === A1 && v1.reviewed_at !== null, JSON.stringify(v1));
check("승인되면 역할이 강사로 바뀜", (await one("postgres", null, "select role from profiles where id=$1", [T1])).role === "instructor");
check("처리된 신청은 다시 바꿀 수 없음", !!(await rejects("authenticated", A1, "update grade_verifications set status='rejected', reject_reason='x' where id=$1", [V1])));
check("이미 인증된 과목에 다시 신청 불가", !!(await rejects("authenticated", T1, "insert into grade_verifications (id, instructor_id, course_id, grade, semester_label, proof_path) values ($1,'t1','cose214','A+','x',$2)", ["aaaaaaaa-0000-4000-8000-0000000000ff", `${T1}/aaaaaaaa-0000-4000-8000-0000000000ff.png`])));
check("인증된 과목에 강의 올리기 (검수 중)", (await as("authenticated", T1, "insert into lectures (id, course_id, instructor_id, title, price, status) values ('t1-algo','cose214','t1','알고리즘 정리',5900,'reviewing') returning id")).rows.length === 1);
check("인증 안 된 과목엔 못 올림", !!(await rejects("authenticated", T1, "insert into lectures (id, course_id, instructor_id, title, price, status) values ('t1-ds','cose213','t1','x',5900,'reviewing')")));
check("남의 이름으로 강의 못 올림", !!(await rejects("authenticated", T1, "insert into lectures (id, course_id, instructor_id, title, price, status) values ('t1-x','cose213','jung','x',5900,'reviewing')")));
check("바로 판매 중으로 올리기 불가", !!(await rejects("authenticated", T1, "insert into lectures (id, course_id, instructor_id, title, price, status) values ('t1-y','cose214','t1','x',5900,'on_sale')")));
check("검수 중 강의는 익명에게 안 보임", (await one("anon", null, "select count(*)::int n from lectures where id='t1-algo'")).n === 0);
check("본인은 검수 중 강의 보임", (await one("authenticated", T1, "select count(*)::int n from lectures where id='t1-algo'")).n === 1);
check("강사가 판매 중으로 셀프 변경 불가", !!(await rejects("authenticated", T1, "update lectures set status='on_sale' where id='t1-algo'")));
check("판매 수 조작 불가", !!(await rejects("authenticated", T1, "update lectures set sales_count=9999 where id='t1-algo'")));
check("남의 강의 수정 안 됨", (await as("authenticated", T1, "update lectures set title='x' where id='ds-final-tree-graph' returning id")).rows.length === 0);
await as("authenticated", T1, "insert into chapters (lecture_id, position, title, minutes, is_preview) values ('t1-algo',0,'0강',8,true),('t1-algo',1,'1강',40,false)");
check("본인 강의에 챕터 추가", (await one("authenticated", T1, "select count(*)::int n from chapters where lecture_id='t1-algo'")).n === 2);
check("운영자가 판매 시작", (await as("authenticated", A1, "update lectures set status='on_sale' where id='t1-algo' returning id")).rows.length === 1);
check("판매 중이 되면 익명에게 보임", (await one("anon", null, "select count(*)::int n from lectures where id='t1-algo'")).n === 1);
check("판매 중 강의 챕터는 강사가 못 고침", (await as("authenticated", T1, "update chapters set title='x' where lecture_id='t1-algo' returning id")).rows.length === 0);

console.log("\n[성적 인증: 캡처 파일]");
{
  const obj = (uid, sql, params) => as("authenticated", uid, sql, params);
  check("남의 폴더에 캡처 업로드 불가", !!(await rejects("authenticated", S2, "insert into storage.objects (bucket_id, name, owner) values ('grade-proofs', $1, $2)", [`${T1}/evil.png`, S2])));
  check("허용 안 된 파일 형식 불가", !!(await rejects("authenticated", T1, "insert into storage.objects (bucket_id, name, owner) values ('grade-proofs', $1, $2)", [`${T1}/x.exe`, T1])));
  check("남의 캡처는 안 보임", (await obj(S2, "select count(*)::int n from storage.objects where bucket_id='grade-proofs'")).rows[0].n === 0);
  check("본인 캡처는 보임", (await obj(T1, "select count(*)::int n from storage.objects where name=$1", [`${T1}/${V1}.png`])).rows[0].n === 1);
  check("운영자는 캡처 조회 가능", (await obj(A1, "select count(*)::int n from storage.objects where name=$1", [`${T1}/${V1}.png`])).rows[0].n === 1);
  check("익명은 캡처 조회 불가", !!(await rejects("anon", null, "select * from storage.objects")) || (await one("anon", null, "select count(*)::int n from storage.objects")).n === 0);
  check("신청자는 캡처를 지울 수 없음", (await obj(T1, "delete from storage.objects where name=$1 returning id", [`${T1}/${V1}.png`])).rows.length === 0);
  // 승인 뒤 운영자가 캡처를 지우고 경로를 비운다
  check("결정 뒤 운영자가 캡처 삭제", (await obj(A1, "delete from storage.objects where name=$1 returning id", [`${T1}/${V1}.png`])).rows.length === 1);
  await obj(A1, "update grade_verifications set proof_path=null where id=$1", [V1]);
  const after = await one("postgres", null, "select proof_path, status, reviewed_by from grade_verifications where id=$1", [V1]);
  check("캡처를 지워도 승인 기록은 남음", after.proof_path === null && after.status === "approved" && after.reviewed_by === A1, JSON.stringify(after));
  check("남의 경로로 신청 불가", !!(await rejects("authenticated", T1, "insert into grade_verifications (id, instructor_id, course_id, grade, semester_label, proof_path) values ($1,'t1','cose213','A+','x',$2)", ["aaaaaaaa-0000-4000-8000-000000000002", `${S1}/aaaaaaaa-0000-4000-8000-000000000002.png`])));
}

console.log("\n[성적 인증: 대기·반려·새 과목]");
{
  const apply = async (id, fields, values) => {
    await as("authenticated", T1, "insert into storage.objects (bucket_id, name, owner) values ('grade-proofs', $1, $2)", [`${T1}/${id}.pdf`, T1]);
    return as("authenticated", T1, `insert into grade_verifications (id, instructor_id, grade, semester_label, proof_path, ${fields}) values ($1,'t1','A+','2025-2학기',$2, ${values.map((_, i) => `$${i + 3}`).join(",")}) returning id`, [id, `${T1}/${id}.pdf`, ...values]);
  };
  const V2 = "aaaaaaaa-0000-4000-8000-000000000003";
  const V3 = "aaaaaaaa-0000-4000-8000-000000000004";
  await apply(V2, "course_id", ["cose213"]);
  check("같은 과목에 대기 중 신청은 하나만", !!(await rejects("authenticated", T1, "insert into grade_verifications (id, instructor_id, course_id, grade, semester_label, proof_path) values ($1,'t1','cose213','A+','x',$2)", [V3, `${T1}/${V3}.pdf`])));
  check("신청 때 상태·처리자를 정해도 무시됨", (await one("postgres", null, "select status, reviewed_by from grade_verifications where id=$1", [V2])).status === "pending");
  check("학생이 승인 시도해도 바뀌지 않음", (await as("authenticated", S1, "update grade_verifications set status='approved', proof_text='x' where id=$1 returning id", [V2])).rows.length === 0);
  check("사유 없이 반려 불가", !!(await rejects("authenticated", A1, "update grade_verifications set status='rejected' where id=$1", [V2])));
  await as("authenticated", A1, "update grade_verifications set status='rejected', reject_reason='캡처에 교수님 이름이 안 보여요' where id=$1", [V2]);
  const rej = await one("authenticated", T1, "select status, reject_reason, reviewed_at from grade_verifications where id=$1", [V2]);
  check("반려 사유는 신청자에게 보임", rej.status === "rejected" && rej.reject_reason.includes("교수님") && rej.reviewed_at !== null, JSON.stringify(rej));
  check("반려된 과목은 다시 신청 가능", (await apply(V3, "course_id", ["cose213"])).rows.length === 1);

  // 목록에 없는 대학 수업: 직접 적어서 신청 → 운영자가 과목을 만들며 승인
  const V4 = "aaaaaaaa-0000-4000-8000-000000000005";
  check("과목도 안 고르고 직접 적지도 않으면 거부", !!(await rejects("authenticated", T1, "insert into grade_verifications (id, instructor_id, grade, semester_label, proof_path) values ($1,'t1','A+','x',$2)", [V4, `${T1}/${V4}.pdf`])));
  await apply(V4, "requested_code, requested_name, requested_professor, requested_semester, requested_track, requested_group, requested_department",
    ["COSE341", "운영체제", "오정민", "2025-2학기", "major", "정보대학", "컴퓨터학과"]);
  const V5 = "aaaaaaaa-0000-4000-8000-000000000006";
  check("같은 과목 직접 신청도 대기 중엔 하나만 (대소문자 무시)", !!(await rejects("authenticated", T1, "insert into grade_verifications (id, instructor_id, grade, semester_label, proof_path, requested_code, requested_name, requested_professor, requested_semester, requested_track, requested_group) values ($1,'t1','A+','x',$2,'cose341','운영체제','오정민','x','major','정보대학')", [V5, `${T1}/${V5}.pdf`])));
  check("과목 없이 승인 불가", !!(await rejects("authenticated", A1, "update grade_verifications set status='approved', proof_text='x' where id=$1", [V4])));
  await as("authenticated", A1, "insert into courses (id, kind, track, code, name, professor, semester, group_name, department, exam_date, exam_label) values ('cose341','major','major','COSE341','운영체제','오정민','2026-2학기','정보대학','컴퓨터학과','2026-12-17','기말고사')");
  await as("authenticated", A1, "update grade_verifications set course_id='cose341', status='approved', proof_text='2025년 2학기 운영체제 A+ 확인' where id=$1", [V4]);
  check("새 과목 승인 후 그 과목에 강의 올리기", (await as("authenticated", T1, "insert into lectures (id, course_id, instructor_id, title, price, status) values ('t1-os','cose341','t1','운영체제 기말 정리',5900,'draft') returning id")).rows.length === 1);
  check("학생은 과목을 만들 수 없음", !!(await rejects("authenticated", S1, "insert into courses (id, kind, track, code, name, professor, semester, group_name, exam_date, exam_label) values ('x9','major','major','X','x','x','x','x','2026-12-01','기말고사')")));
}

console.log("\n[강의 검수]");
{
  await as("authenticated", T1, "update lectures set status='reviewing' where id='t1-os'");
  check("사유 없이 강의 반려 불가", !!(await rejects("authenticated", A1, "update lectures set status='rejected' where id='t1-os'")));
  await as("authenticated", A1, "update lectures set status='rejected', reject_reason='0강 맛보기가 없어요' where id='t1-os'");
  check("강의 반려 사유는 강사에게 보임", (await one("authenticated", T1, "select reject_reason from lectures where id='t1-os'")).reject_reason === "0강 맛보기가 없어요");
  await as("authenticated", T1, "update lectures set status='draft', reject_reason='승인해 주세요' where id='t1-os'");
  check("강사는 반려 사유를 못 바꿈", (await one("postgres", null, "select reject_reason from lectures where id='t1-os'")).reject_reason === "0강 맛보기가 없어요");
  await as("authenticated", T1, "update lectures set status='reviewing' where id='t1-os'");
  const re = await one("postgres", null, "select status, reject_reason from lectures where id='t1-os'");
  check("다시 검수 요청하면 지난 사유는 지워짐", re.status === "reviewing" && re.reject_reason === null, JSON.stringify(re));
  check("강사가 반려 상태로 바꿀 수 없음", !!(await rejects("authenticated", T1, "update lectures set status='rejected', reject_reason='x' where id='t1-os'")));
}

console.log("\n[강사 공개 프로필]");
await as("authenticated", T1, "update profiles set nickname='알고마스터' where id=$1", [T1]);
check("닉네임을 바꾸면 강사 이름도 바뀜", (await one("anon", null, "select name from instructors where id='t1'")).name === "알고마스터");

console.log("\n[내 강의 구매]");
check("내 강의는 주문 불가", !!(await rejects("authenticated", T1, "insert into orders (lecture_id, option) values ('t1-algo','video')")));

console.log("\n[영상 접근]");
await as("service_role", null, `insert into chapter_media (chapter_id, provider, asset_id)
  select id, 'test', 'asset-' || position from chapters where lecture_id='ds-final-tree-graph' and position in (0,1)`);
check("익명은 맛보기 영상만", (await one("anon", null, "select count(*)::int n from chapter_media")).n === 1);
check("수강생은 전체 영상", (await one("authenticated", S1, "select count(*)::int n from chapter_media")).n === 2);
check("미수강생은 맛보기만", (await one("authenticated", S2, "select count(*)::int n from chapter_media")).n === 1);
check("강의 주인(jung은 user 없음) 대신 운영자는 전체", (await one("authenticated", A1, "select count(*)::int n from chapter_media")).n === 2);

console.log("\n[진도]");
check("수강 중 강의 진도 기록", (await as("authenticated", S1, "insert into chapter_progress (user_id, chapter_id, watched_seconds) select $1, id, 120 from chapters where lecture_id='ds-final-tree-graph' and position=1 returning chapter_id", [S1])).rows.length === 1);
check("수강 안 한 강의 진도 기록 불가", !!(await rejects("authenticated", S2, "insert into chapter_progress (user_id, chapter_id) select $1, id from chapters where lecture_id='ds-final-tree-graph' and position=1", [S2])));
check("남의 진도 안 보임", (await one("authenticated", S2, "select count(*)::int n from chapter_progress")).n === 0);

console.log("\n[온보딩]");
{
  const prof = (uid) => one("postgres", null, "select student_id, major, name, nickname, terms_agreed_at, onboarded_at from profiles where id=$1", [uid]);
  check("처음엔 온보딩 전", (await prof(S2)).onboarded_at === null);
  check("학번 형식 아니면 거부", !!(await rejects("authenticated", S2, "update profiles set student_id='12345' where id=$1", [S2])));
  check("학과가 너무 짧으면 거부", !!(await rejects("authenticated", S2, "update profiles set major=' ' || 'a' where id=$1", [S2])));
  check("다른 사람 학번은 못 씀", !!(await rejects("authenticated", S2, "update profiles set student_id='2026123412' where id=$1", [S2])));
  check("onboarded_at 직접 쓰기 불가", !!(await rejects("authenticated", S2, "update profiles set onboarded_at=now() where id=$1", [S2])));
  check("닉네임 형식(공백·특수문자) 거부", !!(await rejects("authenticated", S2, "update profiles set nickname='선배 클래스!' where id=$1", [S2])));
  check("운영진 사칭 닉네임 거부", !!(await rejects("authenticated", S2, "update profiles set nickname='운영자1' where id=$1", [S2])));
  check("서비스 이름 닉네임 거부 (대소문자 무시)", !!(await rejects("authenticated", S2, "update profiles set nickname='Sunbae_kr' where id=$1", [S2])));
  check("이름 한 글자 거부", !!(await rejects("authenticated", S2, "update profiles set name='김' where id=$1", [S2])));
  await as("authenticated", S1, "update profiles set nickname='Tiger' where id=$1", [S1]);
  check("다른 사람 닉네임은 못 씀 (대소문자 무시)", !!(await rejects("authenticated", S2, "update profiles set nickname='tiger' where id=$1", [S2])));
  await as("authenticated", S2, "update profiles set student_id='2025320001', major='  경영학과 ', terms_agreed_at='2000-01-01' where id=$1", [S2]);
  check("이름·닉네임 없으면 온보딩 미완료", (await prof(S2)).onboarded_at === null);
  await as("authenticated", S2, "update profiles set name=' 홍길동 ', nickname='길동이' where id=$1", [S2]);
  const done = await prof(S2);
  check("동의하면 온보딩 완료", done.onboarded_at !== null);
  check("동의 시각은 서버 시각 (보낸 값 무시)", new Date(done.terms_agreed_at).getFullYear() > 2000, String(done.terms_agreed_at));
  check("이름 앞뒤 공백 정리", done.name === "홍길동", done.name);
  check("온보딩 후 닉네임 변경 가능", (await as("authenticated", S2, "update profiles set nickname='길동2' where id=$1 returning id", [S2])).rows.length === 1);
  check("온보딩 후 이름 비우기 불가", !!(await rejects("authenticated", S2, "update profiles set name=null where id=$1", [S2])));
  check("학과 앞뒤 공백 정리", done.major === "경영학과", done.major);
  check("온보딩 후 학번 변경 불가", !!(await rejects("authenticated", S2, "update profiles set student_id='2025320002' where id=$1", [S2])));
  check("온보딩 후 학과 변경은 가능", (await as("authenticated", S2, "update profiles set major='경제학과' where id=$1 returning id", [S2])).rows.length === 1);
  await as("authenticated", S2, "update profiles set terms_agreed_at=null where id=$1", [S2]);
  check("동의 시각·완료 시각은 지워지지 않음", (await prof(S2)).onboarded_at !== null && (await prof(S2)).terms_agreed_at !== null);
  check("운영자(SQL)는 학번 정정 가능", (await as("postgres", null, "update profiles set student_id='2025320002' where id=$1 returning id", [S2])).rows.length === 1);
  check("운영자도 형식은 지켜야 함", !!(await rejects("postgres", null, "update profiles set student_id='abc' where id=$1", [S2])));
}

console.log("\n[그로블 웹훅]");
{
  const W1 = "77777777-7777-7777-7777-777777777777"; // 그로블로 결제하는 학생
  await as("postgres", null, "insert into auth.users (id, email) values ($1,'w1@korea.ac.kr')", [W1]);
  await as("postgres", null, "update profiles set name='결제자', nickname='결제자1', student_id='2025990002', major='경제학과', terms_agreed_at=now(), onboarded_at=now() where id=$1", [W1]);
  const order = (lecture) => one("authenticated", W1, "insert into orders (lecture_id, option) values ($1,'video') returning id, amount", [lecture]);
  const event = (id, type, object) =>
    one("service_role", null, "insert into payment_events (id, type, payload) values ($1, $2, $3) returning result, order_id, merchant_uid, note", [
      id, type, JSON.stringify({ id: `evt_${id}`, type, version: "2026-04-30", occurredAt: "2026-11-25T10:00:00+09:00", data: { object } }),
    ]);
  const orderRow = (id) => one("postgres", null, "select status, provider_order_id, paid_at, refunded_at from orders where id=$1", [id]);
  const active = async (lecture) => (await one("postgres", null, "select count(*)::int n from enrollments where user_id=$1 and lecture_id=$2 and revoked_at is null", [W1, lecture])).n;
  const salesOf = async (lecture) => (await one("postgres", null, "select sales_count from lectures where id=$1", [lecture])).sales_count;

  const o1 = await order("phys-rotation");
  const sales0 = await salesOf("phys-rotation");
  const paid = (ref, merchant, amount) => ({ merchantUid: merchant, sellerReference: ref, pricing: { currency: "KRW", finalAmount: amount } });

  const wrong = await event("k-amount", "payment.completed", paid(o1.id, "m-x", o1.amount - 1000));
  check("금액이 다르면 수강권 안 주고 확인 대기", wrong.result === "needs_review" && (await orderRow(o1.id)).status === "pending" && (await active("phys-rotation")) === 0, JSON.stringify(wrong));
  check("주문번호 없는 결제는 확인 대기", (await event("k-noref", "payment.completed", paid(undefined, "m-y", o1.amount))).result === "needs_review");
  check("형식이 틀린 주문번호는 확인 대기", (await event("k-badref", "payment.completed", paid("ord_1", "m-z", o1.amount))).result === "needs_review");

  const ok = await event("k-paid", "payment.completed", paid(o1.id, "m-1", o1.amount));
  const r1 = await orderRow(o1.id);
  check("결제 완료 웹훅 → 주문 결제 완료 + 그로블 결제번호 저장", ok.result === "applied" && ok.order_id === o1.id && r1.status === "paid" && r1.provider_order_id === "m-1" && r1.paid_at !== null, JSON.stringify({ ok, r1 }));
  check("결제 완료 웹훅 → 수강권 발급 + 판매 수 증가", (await active("phys-rotation")) === 1 && (await salesOf("phys-rotation")) === sales0 + 1);
  check("같은 결제가 다른 키로 또 와도 한 번만 반영", (await event("k-paid-retry", "payment.completed", paid(o1.id, "m-1", o1.amount))).result === "duplicate" && (await active("phys-rotation")) === 1);
  check("같은 키로 다시 오면 거부(중복 키)", !!(await rejects("service_role", null, "insert into payment_events (id, type, payload) values ('k-paid','payment.completed','{}')")));
  check("결제된 주문에 다른 결제가 또 오면 확인 대기", (await event("k-paid-twice", "payment.completed", paid(o1.id, "m-2", o1.amount))).result === "needs_review");

  const o2 = await order("calc-integration");
  const taken = await event("k-taken", "payment.completed", paid(o2.id, "m-1", o2.amount));
  check("이미 쓴 그로블 결제번호로는 발급 안 함(주문은 그대로)", taken.result === "needs_review" && (await orderRow(o2.id)).status === "pending", JSON.stringify(taken));

  const cancelReq = await event("k-cancel", "payment.cancel_requested", { merchantUid: "m-1", cancelRequest: { detailReason: "  시험이 취소됐어요  " } });
  check("환불 요청은 주문과 묶어 확인 대기", cancelReq.result === "needs_review" && cancelReq.order_id === o1.id && cancelReq.note.includes("시험이 취소됐어요"), JSON.stringify(cancelReq));

  const partial = await event("k-partial", "payment.refunded", { merchantUid: "m-1", refund: { amount: 3000, partialRefund: true } });
  check("부분 환불은 수강권 유지 + 확인 대기", partial.result === "needs_review" && (await active("phys-rotation")) === 1 && (await orderRow(o1.id)).status === "paid");

  const refund = await event("k-refund", "payment.refunded", { merchantUid: "m-1", refund: { amount: o1.amount, partialRefund: false } });
  const r2 = await orderRow(o1.id);
  check("환불 웹훅 → 주문 환불 + 수강권 회수 + 판매 수 감소", refund.result === "applied" && r2.status === "refunded" && r2.refunded_at !== null && (await active("phys-rotation")) === 0 && (await salesOf("phys-rotation")) === sales0, JSON.stringify({ refund, r2 }));
  check("환불 웹훅이 또 와도 한 번만 반영", (await event("k-refund-retry", "payment.refunded", { merchantUid: "m-1", refund: { partialRefund: false } })).result === "duplicate");
  check("모르는 결제의 환불은 확인 대기", (await event("k-refund-unknown", "payment.refunded", { merchantUid: "m-unknown" })).result === "needs_review");
  check("다루지 않는 이벤트는 기록만", (await event("k-sub", "subscription_payment.completed", {})).result === "ignored");

  check("학생은 웹훅 기록을 못 넣음", !!(await rejects("authenticated", W1, "insert into payment_events (id, type, payload) values ('k-fake','payment.completed','{}')")));
  check("익명은 웹훅 기록을 못 넣음", !!(await rejects("anon", null, "insert into payment_events (id, type, payload) values ('k-fake','payment.completed','{}')")));
  check("학생은 웹훅 기록이 안 보임", (await one("authenticated", W1, "select count(*)::int n from payment_events")).n === 0);
  check("운영자는 웹훅 기록을 봄", (await one("authenticated", A1, "select count(*)::int n from payment_events")).n > 0);
  check("운영자도 처리 결과는 못 바꿈", !!(await rejects("authenticated", A1, "update payment_events set result='applied' where id='k-amount'")));
  await as("authenticated", A1, "update payment_events set resolved_at='2000-01-01' where id='k-amount'");
  const resolved = await one("postgres", null, "select resolved_at, resolved_by from payment_events where id='k-amount'");
  check("확인 표시: 시각·처리자는 서버가 채움", resolved.resolved_by === A1 && new Date(resolved.resolved_at).getFullYear() > 2000, JSON.stringify(resolved));
  const ch = await one("postgres", null, "select id from chapters where lecture_id='phys-rotation' order by position limit 1");
  await as("postgres", null, "insert into chapter_progress (user_id, chapter_id, completed) values ($1,$2,true)", [W1, ch.id]);
  check("운영자는 환불 판단용 진도를 봄", (await one("authenticated", A1, "select count(*)::int n from chapter_progress where user_id=$1", [W1])).n === 1);
  check("다른 학생 진도는 안 보임", (await one("authenticated", S1, "select count(*)::int n from chapter_progress where user_id=$1", [W1])).n === 0);
  check("학생은 확인 표시 못 함",(await as("authenticated", W1, "update payment_events set resolved_at=now() where id='k-noref' returning id")).rows.length === 0);

  console.log("\n[결제창 링크]");
  const link = "https://groble.im/payment/abc-123";
  check("학생은 결제창 링크 등록 불가", !!(await rejects("authenticated", W1, "insert into lecture_checkout_links (lecture_id, option, url) values ('phys-rotation','video',$1)", [link])));
  await as("authenticated", A1, "insert into lecture_checkout_links (lecture_id, option, url) values ('phys-rotation','video',$1)", [link]);
  check("운영자는 결제창 링크 등록", (await one("authenticated", W1, "select url from lecture_checkout_links where lecture_id='phys-rotation'")).url === link);
  check("익명은 결제창 링크 못 봄", !!(await rejects("anon", null, "select * from lecture_checkout_links")));
  check("그로블이 아닌 주소는 거부", !!(await rejects("authenticated", A1, "insert into lecture_checkout_links (lecture_id, option, url) values ('calc-integration','video','https://evil.example/groble.im/x')")));
  check("http 주소는 거부", !!(await rejects("authenticated", A1, "insert into lecture_checkout_links (lecture_id, option, url) values ('calc-integration','video','http://groble.im/payment/x')")));
  check("쿼리가 붙은 주소는 거부(ref는 서버가 붙임)", !!(await rejects("authenticated", A1, "insert into lecture_checkout_links (lecture_id, option, url) values ('calc-integration','video','https://groble.im/payment/x?ref=1')")));
  check("학생은 링크 수정·삭제 못 함", (await as("authenticated", W1, "delete from lecture_checkout_links returning lecture_id")).rows.length === 0);
}

console.log("\n[선배에게 질문]");
{
  // P1이 T1의 강의(t1-algo)를 수강한다
  await as("service_role", null, "insert into enrollments (user_id, lecture_id, option) values ($1,'t1-algo','video')", [P1]);
  const ch1 = await one("postgres", null, "select id from chapters where lecture_id='t1-algo' and position=1");
  const otherCh = await one("postgres", null, "select id from chapters where lecture_id='ds-final-tree-graph' order by position limit 1");
  const ask = (uid, body, chapter = ch1.id, extra = "") =>
    one("authenticated", uid, `insert into lecture_questions (lecture_id, chapter_id, body${extra ? ", " + extra.split("=")[0] : ""}) values ('t1-algo', $1, $2${extra ? ", " + extra.split("=")[1] : ""}) returning *`, [chapter, body]);

  const q1 = await ask(P1, "  2번 풀이에서 왜 힙을 쓰나요?  ");
  check("수강생은 질문 가능, 작성자·표시 이름은 서버가 채움", q1.user_id === P1 && q1.author_label === "경영학과 25학번" && q1.body === "2번 풀이에서 왜 힙을 쓰나요?", JSON.stringify(q1));
  check("수강생이 아니면 질문 불가", !!(await rejects("authenticated", S2, "insert into lecture_questions (lecture_id, body) values ('t1-algo','x')")));
  check("강의 주인은 자기 강의에 질문 불가(수강생 아님)", !!(await rejects("authenticated", T1, "insert into lecture_questions (lecture_id, body) values ('t1-algo','x')")));
  check("익명은 질문 불가", !!(await rejects("anon", null, "insert into lecture_questions (lecture_id, body) values ('t1-algo','x')")));
  check("다른 강의 챕터로 질문 불가", !!(await ask(P1, "x", otherCh.id).then(() => false, () => true)));
  check("작성자를 남으로 정해서 질문 불가", !!(await rejects("authenticated", P1, "insert into lecture_questions (lecture_id, body, user_id) values ('t1-algo','x',$1)", [S2])));
  check("답변을 미리 채워서 질문 불가", !!(await rejects("authenticated", P1, "insert into lecture_questions (lecture_id, body, answer) values ('t1-algo','x','셀프 답변')")));
  check("빈 질문 불가", !!(await rejects("authenticated", P1, "insert into lecture_questions (lecture_id, body) values ('t1-algo','   ')")));

  check("강의 주인은 질문을 봄", (await one("authenticated", T1, "select count(*)::int n from lecture_questions where lecture_id='t1-algo'")).n === 1);
  check("수강하지 않은 학생은 질문이 안 보임", (await one("authenticated", S2, "select count(*)::int n from lecture_questions")).n === 0);
  check("익명은 질문이 안 보임", !!(await rejects("anon", null, "select * from lecture_questions")));
  check("운영자는 질문을 봄", (await one("authenticated", A1, "select count(*)::int n from lecture_questions")).n === 1);

  check("답변 전에는 작성자가 질문 수정 가능", (await as("authenticated", P1, "update lecture_questions set body='2번에서 왜 힙인가요?' where id=$1 returning id", [q1.id])).rows.length === 1);
  check("수강생은 답변 못 함", !!(await rejects("authenticated", P1, "update lecture_questions set answer='셀프' where id=$1", [q1.id])));
  check("강의 주인은 질문 내용을 못 고침", !!(await rejects("authenticated", T1, "update lecture_questions set body='x' where id=$1", [q1.id])));
  const answered = await one("authenticated", T1, "update lecture_questions set answer='  매번 최솟값을 꺼내야 해서예요.  ' where id=$1 returning answer, answered_by, answered_at", [q1.id]);
  check("강의 주인이 답변, 답변자·시각은 서버가 채움", answered.answer === "매번 최솟값을 꺼내야 해서예요." && answered.answered_by === T1 && answered.answered_at !== null, JSON.stringify(answered));
  check("답변 달린 질문은 작성자가 못 고침", !!(await rejects("authenticated", P1, "update lecture_questions set body='y' where id=$1", [q1.id])));
  check("답변 달린 질문은 작성자가 못 지움", (await as("authenticated", P1, "delete from lecture_questions where id=$1 returning id", [q1.id])).rows.length === 0);
  check("작성자·표시 이름은 못 바꿈", !!(await rejects("authenticated", P1, "update lecture_questions set author_label='운영자' where id=$1", [q1.id])));
  check("다른 강사는 답변 못 함", (await as("authenticated", S2, "update lecture_questions set answer='x' where id=$1 returning id", [q1.id])).rows.length === 0);

  const q2 = await ask(P1, "3강 자료는 언제 올라오나요?");
  check("답변 전 질문은 작성자가 지움", (await as("authenticated", P1, "delete from lecture_questions where id=$1 returning id", [q2.id])).rows.length === 1);
  await as("service_role", null, "update enrollments set revoked_at=now() where user_id=$1 and lecture_id='t1-algo'", [P1]);
  check("환불하면 질문을 더 못 함", !!(await rejects("authenticated", P1, "insert into lecture_questions (lecture_id, body) values ('t1-algo','x')")));
}

console.log("\n[헬퍼 함수]");
check("트리거 함수 직접 호출 불가", !!(await rejects("authenticated", S1, "select private.sync_review_counters()")));
check("헬퍼가 public(API 노출 스키마)에 없음", (await one("postgres", null, "select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'")).n === 0);

console.log(`\n결과: ${pass} 통과, ${fail} 실패`);
process.exit(fail ? 1 : 0);
