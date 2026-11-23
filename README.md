# 선배클래스 (sunbae-class)

같은 수업에서 A+를 받은 선배가 교수·분반 기준 시험 대비 강의를 올리고, 수강생이 과목별로 단건 결제하는 서비스입니다.

현재 상태:

- 공개 화면(홈, 과목 찾기, 과목, 강의 상세)은 **Supabase DB**에서 읽습니다. 데이터는 예시 시드입니다.
- 로그인, 결제(그로블), 영상 스트리밍은 아직 연결하지 않았습니다.
- 강사 센터(`/instructor`)·운영자(`/admin`)는 로그인이 필요해서 아직 `lib/mock-data.ts` 더미 데이터를 씁니다.

## 실행

```bash
npm install
cp .env.example .env.local   # Supabase URL과 publishable 키 채우기
npm run dev
```

`.env.local` 값은 Supabase 대시보드 → Project Settings → API Keys에서 확인합니다. 빌드할 때도 DB를 읽으므로 배포 환경에도 같은 변수가 필요합니다.

http://localhost:3000 에서 확인합니다.

## 화면

| 경로 | 화면 |
|---|---|
| `/` | 홈: 분반 검색, 많이 팔린 강의, 결제 전에 확인할 것 |
| `/courses` | 과목 찾기: 전공·교양 / 자격증·어학 탭, 단과대학·분야 필터, 정렬 |
| `/courses/[courseId]` | 과목(분반) 페이지: 강의 목록, 강사가 없을 때 빈 화면 |
| `/lectures/[lectureId]` | 강의 상세: 맛보기, 성적 인증 배지, 커리큘럼, 후기, 결제 옵션(영상/스터디반) |
| `/watch/[lectureId]` | 시청: 학번 워터마크, 챕터 목록, 진도율 |
| `/instructor` | 강사 센터: 인증 상태, 판매·정산, 강의 업로드 폼 |
| `/admin` | 운영자: 성적 인증 승인/반려 대기열 |

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

마이그레이션 `20261123031100_harden_helpers`는 SQL Editor로 적용해서 원격 이력에 없습니다.
Supabase CLI를 쓰기 시작하면 `supabase migration repair --status applied 20261123031100`을 한 번 실행하세요.

## 알려진 동작

- 없는 강의·과목 주소는 "없는 페이지예요" 화면과 `noindex`가 나오지만 HTTP 상태는 200입니다.
  부분 사전 렌더링(cacheComponents)이 껍데기를 먼저 보낸 뒤 `notFound()`가 실행되기 때문입니다.

## 다음 단계

1. ~~데이터 접근 계층 분리~~
2. ~~Supabase 프로젝트 연결: 마이그레이션·시드 적용, 공개 화면을 Supabase 조회로 교체~~
3. 학교 이메일 인증(Supabase Auth), `/instructor`·`/admin`·`/watch` 접근 제어
4. 성적 캡처 업로드(비공개 Storage) → 운영자 승인/반려 → 캡처 삭제
5. 결제: 그로블 상품 링크, `app/api/webhooks/groble`에서 수강권 발급, 환불 규칙
6. 시청: 스트리밍 서비스 플레이어 + 서명된 재생 토큰, 진도 기록
7. 후기 작성, 선배에게 질문, 정산, Vercel 배포
