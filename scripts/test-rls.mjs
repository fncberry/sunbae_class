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
check("수강생은 후기 작성 가능", (await as("authenticated", S1, "insert into reviews (lecture_id, user_id, author_label, rating, body) values ('ds-final-tree-graph',$1,'컴퓨터학과 26학번',5,'좋아요') returning id", [S1])).rows.length === 1);
const ds4 = await one("anon", null, "select review_count, rating_sum from lectures where id='ds-final-tree-graph'");
check("후기 카운터 +1", ds4.review_count === 39 && ds4.rating_sum === 191, JSON.stringify(ds4));
check("수강 안 한 강의는 후기 작성 불가", !!(await rejects("authenticated", S2, "insert into reviews (lecture_id, user_id, author_label, rating, body) values ('ds-final-tree-graph',$1,'x',1,'x')", [S2])));
check("남 이름으로 후기 작성 불가", !!(await rejects("authenticated", S2, "insert into reviews (lecture_id, user_id, author_label, rating, body) values ('ds-final-tree-graph',$1,'x',1,'x')", [S1])));
check("남의 후기 수정 안 됨", (await as("authenticated", S2, "update reviews set body='x' where user_id=$1 returning id", [S1])).rows.length === 0);

console.log("\n[강사 지원 → 인증 → 강의 올리기]");
await as("authenticated", T1, "insert into instructors (id, user_id, name, major, admission_year) values ('t1',$1,'테스트','컴퓨터학과',24)", [T1]);
check("강사 프로필은 한 사람당 하나", !!(await rejects("authenticated", T1, "insert into instructors (id, user_id, name, major) values ('t1b',$1,'x','x')", [T1])));
check("남의 user_id로 강사 프로필 생성 불가", !!(await rejects("authenticated", S2, "insert into instructors (id, user_id, name, major) values ('t2',$1,'x','x')", [T1])));
check("인증 전에는 강의 못 올림", !!(await rejects("authenticated", T1, "insert into lectures (id, course_id, instructor_id, title, price, status) values ('t1-algo','cose214','t1','알고리즘 정리',5900,'reviewing')")));
await as("authenticated", T1, "insert into grade_verifications (instructor_id, course_id, grade, semester_label) values ('t1','cose214','A+','2025-2학기')");
check("신청은 pending으로 생성", (await one("authenticated", T1, "select status from grade_verifications where instructor_id='t1'")).status === "pending");
check("신청자가 직접 승인 불가", !!(await rejects("authenticated", T1, "update grade_verifications set status='approved' where instructor_id='t1'")) || (await as("authenticated", T1, "update grade_verifications set status='approved' where instructor_id='t1' returning id")).rows.length === 0);
check("남의 강사 프로필로 신청 불가", !!(await rejects("authenticated", S2, "insert into grade_verifications (instructor_id, course_id, grade, semester_label) values ('t1','cose213','A+','x')")));
check("pending 신청은 익명에게 안 보임", (await one("anon", null, "select count(*)::int n from grade_verifications where instructor_id='t1'")).n === 0);
check("운영자는 대기열 6건 확인", (await one("authenticated", A1, "select count(*)::int n from grade_verifications where status='pending'")).n === 6);
await as("authenticated", A1, "update grade_verifications set status='approved', proof_text='확인했어요', reviewed_by=$1, reviewed_at=now() where instructor_id='t1'", [A1]);
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
  const prof = (uid) => one("postgres", null, "select student_id, major, terms_agreed_at, onboarded_at from profiles where id=$1", [uid]);
  check("처음엔 온보딩 전", (await prof(S2)).onboarded_at === null);
  check("학번 형식 아니면 거부", !!(await rejects("authenticated", S2, "update profiles set student_id='12345' where id=$1", [S2])));
  check("학과가 너무 짧으면 거부", !!(await rejects("authenticated", S2, "update profiles set major=' ' || 'a' where id=$1", [S2])));
  check("다른 사람 학번은 못 씀", !!(await rejects("authenticated", S2, "update profiles set student_id='2026123412' where id=$1", [S2])));
  check("onboarded_at 직접 쓰기 불가", !!(await rejects("authenticated", S2, "update profiles set onboarded_at=now() where id=$1", [S2])));
  await as("authenticated", S2, "update profiles set student_id='2025320001', major='  경영학과 ' where id=$1", [S2]);
  check("약관 동의 전에는 온보딩 미완료", (await prof(S2)).onboarded_at === null);
  await as("authenticated", S2, "update profiles set terms_agreed_at='2000-01-01' where id=$1", [S2]);
  const done = await prof(S2);
  check("동의하면 온보딩 완료", done.onboarded_at !== null);
  check("동의 시각은 서버 시각 (보낸 값 무시)", new Date(done.terms_agreed_at).getFullYear() > 2000, String(done.terms_agreed_at));
  check("학과 앞뒤 공백 정리", done.major === "경영학과", done.major);
  check("온보딩 후 학번 변경 불가", !!(await rejects("authenticated", S2, "update profiles set student_id='2025320002' where id=$1", [S2])));
  check("온보딩 후 학과 변경은 가능", (await as("authenticated", S2, "update profiles set major='경제학과' where id=$1 returning id", [S2])).rows.length === 1);
  await as("authenticated", S2, "update profiles set terms_agreed_at=null where id=$1", [S2]);
  check("동의 시각·완료 시각은 지워지지 않음", (await prof(S2)).onboarded_at !== null && (await prof(S2)).terms_agreed_at !== null);
  check("운영자(SQL)는 학번 정정 가능", (await as("postgres", null, "update profiles set student_id='2025320002' where id=$1 returning id", [S2])).rows.length === 1);
  check("운영자도 형식은 지켜야 함", !!(await rejects("postgres", null, "update profiles set student_id='abc' where id=$1", [S2])));
}

console.log("\n[헬퍼 함수]");
check("트리거 함수 직접 호출 불가", !!(await rejects("authenticated", S1, "select private.sync_review_counters()")));
check("헬퍼가 public(API 노출 스키마)에 없음", (await one("postgres", null, "select count(*)::int n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'")).n === 0);

console.log(`\n결과: ${pass} 통과, ${fail} 실패`);
process.exit(fail ? 1 : 0);
