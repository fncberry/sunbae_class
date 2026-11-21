# 선배클래스 (sunbae-class)

같은 수업에서 A+를 받은 선배가 교수·분반 기준 시험 대비 강의를 올리고, 수강생이 과목별로 단건 결제하는 서비스의 **목업**입니다.
결제(그로블), DB(Supabase), 영상 스트리밍은 아직 연결하지 않았고 `lib/mock-data.ts`의 더미 데이터로 화면만 구성했습니다.
DB 스키마와 권한 정책(`supabase/`)은 준비되어 있고, Supabase 프로젝트에 적용하는 단계가 남았습니다.

## 실행

```bash
npm install
npm run dev
```

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

화면은 `lib/data.ts`의 조회 함수로만 데이터를 가져옵니다. 지금은 함수 안에서 `lib/mock-data.ts`를 읽고, Supabase를 연결하면 이 파일의 함수 본문만 바꿉니다.

| 파일 | 내용 |
|---|---|
| `lib/types.ts` | 도메인 타입 |
| `lib/data.ts` | 조회 함수. 공개 카탈로그는 `"use cache"` + `cacheTag("catalog")` |
| `lib/mock-data.ts` | 더미 데이터 (`supabase/seed.sql`의 원본) |
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

## 다음 단계

1. ~~데이터 접근 계층 분리~~
2. Supabase 프로젝트 연결: 마이그레이션·시드 적용, `lib/data.ts` 본문을 Supabase 조회로 교체
3. 학교 이메일 인증(Supabase Auth), `/instructor`·`/admin`·`/watch` 접근 제어
4. 성적 캡처 업로드(비공개 Storage) → 운영자 승인/반려 → 캡처 삭제
5. 결제: 그로블 상품 링크, `app/api/webhooks/groble`에서 수강권 발급, 환불 규칙
6. 시청: 스트리밍 서비스 플레이어 + 서명된 재생 토큰, 진도 기록
7. 후기 작성, 선배에게 질문, 정산, Vercel 배포
