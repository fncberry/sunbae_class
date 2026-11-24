# 선배클래스 (sunbae-class)

같은 수업에서 A+를 받은 선배가 교수·분반 기준 시험 대비 강의를 올리고, 수강생이 과목별로 단건 결제하는 서비스입니다.

현재 상태:

- 공개 화면(홈, 과목 찾기, 과목, 강의 상세)은 **Supabase DB**에서 읽습니다. 데이터는 예시 시드입니다.
- 과목 찾기(`/courses`)는 왼쪽 카테고리(전공 → 단과대학, 교양, 자격증·어학)와 강의 카드 목록입니다. 카테고리·정렬·보기 방식은 URL(`?c=&d=&sort=&view=`)에 남습니다.
- **고려대 구글 계정(@korea.ac.kr) 로그인**이 됩니다. 고려대 메일은 Google Workspace라 학교 메일 계정으로 구글 로그인을 합니다.
- 처음 로그인하면 **온보딩**(이름·닉네임·학번·학과·개인정보 동의)을 거칩니다. 온보딩 전에는 `/instructor`·`/watch`·`/admin`이 열리지 않습니다.
- 성적 인증(캡처 업로드 → 운영자 승인·반려 → 캡처 삭제)과 강의 검수가 됩니다.
- 결제: 결제 버튼이 pending 주문을 만들고 `/checkout`에서 그로블 결제창(`?ref=주문 id`)으로 보냅니다. 그로블 웹훅이 결제 완료 시 수강권을 주고, 환불 시 회수합니다.
- 수강생은 `/watch`에서 전체 강의를, 그 밖에는 맛보기만 봅니다. 영상 스트리밍은 아직 연결하지 않았습니다(6단계).

## 실행

```bash
npm install
cp .env.example .env.local   # Supabase URL과 publishable 키 채우기
npm run dev
```

`.env.local` 값은 Supabase 대시보드 → Project Settings → API Keys에서 확인합니다. 빌드할 때도 DB를 읽으므로 배포 환경에도 같은 변수가 필요합니다.

그로블 웹훅을 받으려면 서버 전용 변수 두 개가 더 필요합니다(이름에 `NEXT_PUBLIC_`을 붙이지 않음). 없으면 웹훅은 503으로 답하고 그로블이 다시 보냅니다.

- `SUPABASE_SECRET_KEY`: Supabase secret 키(`sb_secret_…`). 웹훅 기록에만 씀(`lib/supabase/service.ts`)
- `GROBLE_WEBHOOK_SECRET`: 그로블 내 스토어 → 연동 → 웹훅 등록 때 한 번 보여주는 시크릿

http://localhost:3000 에서 확인합니다.

## 로그인

| 파일 | 역할 |
|---|---|
| `app/(main)/login/` | "고려대 구글 계정으로 로그인" 버튼 → `signInWithOAuth`(google, `hd=korea.ac.kr`)로 이동 (서버 액션) |
| `app/auth/callback/route.ts` | 구글 로그인 뒤 돌아오는 곳. 세션 쿠키를 만들고 원래 화면으로 이동, 실패하면 이유별 안내 |
| `proxy.ts` | 모든 요청에서 세션 갱신 + 로그인 필요 경로는 `/login?next=`로 1차 리다이렉트 |
| `lib/auth.ts` | `getCurrentUser`·`requireSignedIn`(로그인만)·`requireUser`(로그인+온보딩)·`requireAdmin`. 실제 권한 검사는 여기서 |
| `app/(main)/onboarding/` | 첫 로그인 후 이름·닉네임·학번·학과·동의 입력 (서버 액션 `completeOnboarding`) |
| `lib/onboarding.ts` | 이름·닉네임·학번·학과 입력 규칙, 고려대 구글 계정 이름(`홍길동[ 학부재학 / 컴퓨터학과 ]`)에서 이름·학과 읽기 |

- 학교 메일 제한은 DB 트리거(`auth.users`)가 합니다. `hd`는 구글 계정 선택 화면의 힌트일 뿐이라, 개인 Gmail을 골라도 트리거가 가입을 막고 로그인 화면에 안내가 나옵니다. 공개 키로 Auth API를 직접 불러도 다른 도메인은 가입할 수 없습니다.
- 메일 발송(SMTP)은 쓰지 않습니다.

### 온보딩 (`20261123102103_onboarding`, `20261123103621_profile_names`)

- 로그인 콜백에서 `profiles.onboarded_at`이 비어 있으면 `/onboarding?next=`로 보냅니다.
- `profiles`에 `name`(실명, 비공개), `nickname`(서비스 안에서 보이는 이름), `major`, `terms_agreed_at`, `onboarded_at`이 있습니다. 본인은 `name`·`nickname`·`student_id`·`major`·`terms_agreed_at`만 쓸 수 있습니다.
- 트리거 `private.guard_profile_update`가 동의 시각과 완료 시각을 서버 시각으로 정합니다(클라이언트 값 무시). 다섯 값이 다 차면 `onboarded_at`이 찍히고, 그 뒤에는 이름·닉네임·학과를 비울 수 없습니다.
- 닉네임: 한글·영문·숫자·`_`·`.` 2~12자, 대소문자 무시하고 겹칠 수 없음, `운영`·`관리자`·`admin`·`선배클래스`·`sunbae`가 들어가면 거부. 헤더에는 닉네임이 보입니다.
- 학번은 `(19|20)` + 8자리, 한 학번은 한 계정만(워터마크를 남에게 돌리지 못하게). 온보딩 후에는 본인이 바꿀 수 없고, 정정은 SQL Editor에서 운영자가 합니다.
- 이름·닉네임·학과는 바꿀 수 있습니다. 구글 계정 이름은 이름·학과를 미리 채우는 데만 쓰고, 사용자가 확인해 제출한 값만 저장합니다.
- 운영자가 아니면 `/admin`은 404로 보입니다.
- 운영자 지정은 SQL로만 합니다 (앱에서 자기 역할을 바꿀 수 없음):
  `update public.profiles set role = 'admin' where email = '아이디@korea.ac.kr';`

Supabase 대시보드에서 해야 하는 설정:

1. Authentication → Sign In / Providers → Google: Google Cloud Console에서 만든 OAuth 클라이언트(웹 애플리케이션)의 Client ID·Secret.
   Google 쪽 승인된 리디렉션 URI는 `https://<프로젝트 ref>.supabase.co/auth/v1/callback`
2. Google Cloud Console → OAuth 동의 화면: 게시 상태가 "테스트"면 등록한 테스트 사용자만 로그인됩니다. 학생에게 열 때 "프로덕션"으로 게시 (email·profile 범위만 써서 심사 불필요)
3. Authentication → URL Configuration: Site URL과 Redirect URLs에 `http://localhost:3000/**`, 배포 주소 `/**` 추가. 빠지면 로그인 뒤 Site URL로 튕깁니다.

## 화면

| 경로 | 화면 |
|---|---|
| `/` | 홈: 분반 검색, 많이 팔린 강의, 결제 전에 확인할 것 |
| `/courses` | 과목 찾기: 전공·교양 / 자격증·어학 탭, 단과대학·분야 필터, 정렬 |
| `/courses/[courseId]` | 과목(분반) 페이지: 강의 목록, 강사가 없을 때 빈 화면 |
| `/lectures/[lectureId]` | 강의 상세: 맛보기, 성적 인증 배지, 커리큘럼, 후기, 결제 옵션(영상/스터디반) |
| `/login` | 고려대 구글 계정으로 로그인 |
| `/onboarding` | 가입 마무리 (로그인 필요): 이름·학과(학교 계정에서 미리 채움), 닉네임, 학번, 개인정보 수집·이용 동의 |
| `/watch/[lectureId]` | 시청 (로그인 필요): 수강생·강의 주인·운영자는 전체, 그 밖에는 맛보기. `?c=위치`로 챕터 선택, 학번 워터마크, "다 봤어요" 진도 |
| `/checkout/[orderId]` | 결제 (로그인 필요): 내 주문, 그로블 결제창 링크(운영자가 등록하지 않았으면 "아직 결제를 받을 수 없어요") |
| `/my` | 내 강의 (로그인 필요): 수강 중인 강의와 진도, 결제 내역 |
| `/instructor` | 강사 센터 (로그인 필요): 성적 인증 신청, 내 신청 상태, 승인된 과목의 강의 초안·검수 요청 |
| `/admin` | 운영자 (운영자만): 성적 인증 대기열, 캡처 열람(`/admin/proofs/[id]`), 강의 검수(`/admin/lectures`), 결제(`/admin/payments`: 확인할 결제, 강의별 결제창 링크) |
| `/api/webhooks/groble` | 그로블 웹훅 (POST, 서명 확인) |

## 데이터

화면은 `lib/data.ts`의 조회 함수로만 데이터를 가져옵니다.

| 파일 | 내용 |
|---|---|
| `lib/types.ts` | 화면에서 쓰는 도메인 타입 |
| `lib/data.ts` | 조회 함수. 공개 카탈로그는 Supabase(anon, RLS) + `"use cache"` + `cacheTag("catalog")` |
| `lib/learning.ts` | 수강생: 수강권, 시청 화면, 진도, 주문 (캐시 없음) |
| `lib/instructor-center.ts`, `lib/admin.ts` | 강사 센터, 운영자 화면 (캐시 없음) |
| `lib/groble.ts` | 그로블 결제창 링크(`?ref=`), 웹훅 서명 확인 |
| `lib/supabase/public.ts` | 공개 데이터용 서버 클라이언트 (세션 없음) |
| `lib/database.types.ts` | Supabase가 생성한 DB 타입 |
| `lib/mock-data.ts` | 더미 데이터. `supabase/seed.sql`의 원본이자 강사 센터·운영자 화면의 임시 데이터 |
| `supabase/migrations/` | 테이블, 트리거, RLS 정책 |
| `supabase/seed.sql` | `npm run db:seed:generate`로 생성 (직접 고치지 않음) |

```bash
npm run db:seed:generate  # mock-data.ts → supabase/seed.sql
npm run db:test           # PGlite로 마이그레이션+시드 적용 후 권한 시나리오 검증 (Docker 불필요)
```

권한 요약:

- 누구나: 과목, 강사 공개 프로필, 판매 중 강의·목차, 후기, 승인된 성적 인증
- 본인만: 프로필(이메일·학번), 주문, 수강권, 진도, 내 인증 신청
- 영상 재생 정보(`chapter_media`): 맛보기 챕터, 수강생, 강의 주인, 운영자
- 주문: 학생은 `(lecture_id, option)`만 보내 pending 주문을 만들고, 금액·주문자·상태는 트리거가 정함. paid·refunded 전환과 수강권 발급은 서버(service_role)만
- 후기: 수강생만, `(lecture_id, rating, body)`만 보냄. 작성자·표시 이름("학과 NN학번")·시각은 트리거가 채움
- 판매 수·평점·스터디반 인원은 트리거가 관리
- 익명 사용자는 `instructors`·`reviews`·`grade_verifications`의 공개 컬럼만 읽음(`user_id` 등 숨김). 공개 조회에서 이 표에 `select("*")`를 쓰면 실패함
- 강사는 인증받은 과목에만 강의를 올릴 수 있고, `판매 중` 전환은 운영자만
- RLS 헬퍼·트리거 함수는 API에 노출되지 않는 `private` 스키마에 있음
- 승인된 성적 인증이 없는 강의는 공개 목록에서 빠짐 (성적 배지를 꾸며 붙이지 않기 위해)

### 전공·교양 구분 (`20261123050000_course_track`)

대학 수업(`kind = 'major'`)에 `track` 컬럼(`major` 전공 / `liberal` 교양)을 추가했습니다. 자격증·어학은 `null`입니다.
과목 찾기 화면에서 전공은 단과대학별로, 교양은 한 목록으로 보여줍니다.

원격 DB에 적용하는 순서:

1. `supabase/migrations/20261123050000_course_track.sql` 실행 (기존 대학 수업은 전부 `major`로 채워짐)
2. 새 시드(공과대학·경영대학·교양 과목 추가)를 넣으려면 기존 데이터를 비운 뒤 `supabase/seed.sql` 실행

마이그레이션 전 DB에서도 앱은 동작합니다. `track`이 없으면 대학 수업을 전부 전공으로 봅니다.

원격 DB에는 2026-11-23에 적용했습니다(이력 버전 `20261123102047`). 새 시드 행은 기존 데이터를 지우지 않고 추가분만 `on conflict do nothing`으로 넣었습니다.
Supabase CLI를 쓰기 시작하면 파일 이름과 버전이 달라서 `supabase migration repair`로 맞춰야 합니다.

마이그레이션 `20261123031100_harden_helpers`는 SQL Editor로 적용해서 원격 이력에 없습니다.
Supabase CLI를 쓰기 시작하면 `supabase migration repair --status applied 20261123031100`을 한 번 실행하세요.

### 결제 준비 (`20261124060000_purchase_groundwork`)

- 결제 버튼 → 서버 액션 `startCheckout`이 pending 주문을 만들고 `/checkout/[orderId]`로 보냄. 24시간 안의 같은 강의·같은 방식 pending 주문은 다시 씀
- 주문 거부(트리거): 판매 중이 아님, 이미 수강 중, 내 강의, 스터디반 없음, 스터디반 정원 참, 온보딩 전
- 주문 상태는 pending → paid·cancelled, paid → refunded만. 금액·주문자·강의·방식은 바꿀 수 없음. `paid_at`·`refunded_at`은 자동 기록
- 수강권(`enrollments`)은 `id`가 기본 키. 살아 있는 수강권은 `(user_id, lecture_id)`당 하나라서 환불(`revoked_at`) 뒤 다시 살 수 있음. 스터디반 정원은 되살리거나 옵션을 바꿀 때도 확인
- 판매를 멈춘(`hidden`) 강의도 수강권이 있으면 볼 수 있음
- 로그인 뒤 돌아갈 주소(`safeNextPath`)는 URL로 해석해 같은 출처만 통과

### 그로블 결제 (`20261125010000_groble_webhook`, `20261125020000_admin_progress`)

- 결제창 링크: 강의·구매 방식마다 운영자가 `/admin/payments`에서 등록(`lecture_checkout_links`). `https://groble.im/…`만, `?` 없이. 그로블 상품 금액은 강의 가격과 같아야 함
- `/checkout`은 링크 뒤에 `?ref=<주문 id>`를 붙임 → 결제 완료 웹훅의 `sellerReference`로 돌아옴
- 웹훅: `X-Groble-Signature` = HEX(HMAC-SHA256(시크릿, `{timestamp}.{원문}`)), ±5분. 시크릿 재발급 뒤 24시간은 `X-Groble-Signature-Previous`도 허용
- 서버는 `payment_events`에 원문을 넣기만 하고, 트리거 `private.apply_payment_event`가 한 트랜잭션으로 반영
  - `payment.completed`: 주문번호·금액이 맞으면 주문 paid(`provider_order_id` = 그로블 `merchantUid`) + 수강권 발급
  - `payment.refunded`: `merchantUid`로 주문을 찾아 refunded + 수강권 회수. 부분 환불은 수강권 유지
  - `payment.cancel_requested`: 운영자 확인 목록에 올림(진도·환불 기한과 함께). 승인·거절은 그로블에서
  - 같은 결제·환불이 다시 오면 `duplicate`, 같은 전송 키(`X-Groble-Idempotency-Key`)는 기본 키로 막힘
  - 금액 불일치, 주문번호 없음, 이미 수강 중, 스터디반 정원 참 등은 에러 대신 `needs_review`로 남김(그로블이 같은 실패를 재전송하지 않게). `/admin/payments`에서 확인 후 "확인했어요"
- 응답: 서명 실패 401, 설정 누락 503·DB 오류 500(그로블이 최대 7번 재전송), 그 밖에는 200
- 운영자는 환불 판단용으로 수강생 진도를 볼 수 있음

## 알려진 동작

- 없는 강의·과목 주소는 "없는 페이지예요" 화면과 `noindex`가 나오지만 HTTP 상태는 200입니다.
  부분 사전 렌더링(cacheComponents)이 껍데기를 먼저 보낸 뒤 `notFound()`가 실행되기 때문입니다.

## 다음 단계

1. ~~데이터 접근 계층 분리~~
2. ~~Supabase 프로젝트 연결: 마이그레이션·시드 적용, 공개 화면을 Supabase 조회로 교체~~
3. ~~학교 이메일 인증(Supabase Auth), `/instructor`·`/admin`·`/watch` 접근 제어~~
4. ~~성적 캡처 업로드(비공개 Storage) → 운영자 승인/반려 → 캡처 삭제~~
5. ~~결제: 주문·수강권·후기, 그로블 결제창·웹훅으로 결제 확인·수강권 발급, 환불~~
6. 시청: 스트리밍 서비스 플레이어 + 서명된 재생 토큰, 진도 기록
7. 후기 작성, 선배에게 질문, 정산, Vercel 배포
