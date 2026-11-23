# 선배클래스 (sunbae-class)

같은 수업에서 A+를 받은 선배가 교수·분반 기준 시험 대비 강의를 올리고, 수강생이 과목별로 단건 결제하는 서비스입니다.

현재 상태:

- 공개 화면(홈, 과목 찾기, 과목, 강의 상세)은 **Supabase DB**에서 읽습니다. 데이터는 예시 시드입니다.
- 과목 찾기(`/courses`)는 왼쪽 카테고리(전공 → 단과대학, 교양, 자격증·어학)와 강의 카드 목록입니다. 카테고리·정렬·보기 방식은 URL(`?c=&d=&sort=&view=`)에 남습니다.
- **고려대 구글 계정(@korea.ac.kr) 로그인**이 됩니다. 고려대 메일은 Google Workspace라 학교 메일 계정으로 구글 로그인을 합니다.
- 처음 로그인하면 **온보딩**(이름·닉네임·학번·학과·개인정보 동의)을 거칩니다. 온보딩 전에는 `/instructor`·`/watch`·`/admin`이 열리지 않습니다.
- `/instructor`·`/watch`는 로그인, `/admin`은 운영자만 열립니다. 다만 강사 센터·운영자 화면의 내용은 아직 예시 데이터입니다.
- 결제(그로블), 영상 스트리밍은 아직 연결하지 않았습니다.

## 실행

```bash
npm install
cp .env.example .env.local   # Supabase URL과 publishable 키 채우기
npm run dev
```

`.env.local` 값은 Supabase 대시보드 → Project Settings → API Keys에서 확인합니다. 빌드할 때도 DB를 읽으므로 배포 환경에도 같은 변수가 필요합니다.

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
| `/watch/[lectureId]` | 시청 (로그인 필요): 내 학번 워터마크, 챕터 목록, 진도율(예시) |
| `/instructor` | 강사 센터 (로그인 필요, 내용은 예시): 인증 상태, 판매·정산, 강의 업로드 폼 |
| `/admin` | 운영자 (운영자만, 내용은 예시): 성적 인증 승인/반려 대기열 |

## 데이터

화면은 `lib/data.ts`의 조회 함수로만 데이터를 가져옵니다.

| 파일 | 내용 |
|---|---|
| `lib/types.ts` | 화면에서 쓰는 도메인 타입 |
| `lib/data.ts` | 조회 함수. 공개 카탈로그는 Supabase(anon, RLS) + `"use cache"` + `cacheTag("catalog")` |
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
- 주문·수강권 쓰기는 서버(service_role)만. 판매 수·평점·스터디반 인원은 트리거가 관리
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

## 알려진 동작

- 없는 강의·과목 주소는 "없는 페이지예요" 화면과 `noindex`가 나오지만 HTTP 상태는 200입니다.
  부분 사전 렌더링(cacheComponents)이 껍데기를 먼저 보낸 뒤 `notFound()`가 실행되기 때문입니다.

## 다음 단계

1. ~~데이터 접근 계층 분리~~
2. ~~Supabase 프로젝트 연결: 마이그레이션·시드 적용, 공개 화면을 Supabase 조회로 교체~~
3. ~~학교 이메일 인증(Supabase Auth), `/instructor`·`/admin`·`/watch` 접근 제어~~
4. 성적 캡처 업로드(비공개 Storage) → 운영자 승인/반려 → 캡처 삭제
5. 결제: 그로블 상품 링크, `app/api/webhooks/groble`에서 수강권 발급, 환불 규칙
6. 시청: 스트리밍 서비스 플레이어 + 서명된 재생 토큰, 진도 기록
7. 후기 작성, 선배에게 질문, 정산, Vercel 배포
