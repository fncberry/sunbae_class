# 선배클래스 (sunbae-class)

같은 수업에서 A+를 받은 선배가 교수·분반 기준 시험 대비 강의를 올리고, 수강생이 과목별로 단건 결제하는 서비스의 **목업**입니다.
결제(그로블), DB(Supabase), 영상 스트리밍은 아직 연결하지 않았고 `lib/mock-data.ts`의 더미 데이터로 화면만 구성했습니다.

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

## 다음 단계

- `lib/mock-data.ts` → Supabase 테이블(courses, lectures, instructors, purchases)로 교체
- 결제 버튼 → 그로블 상품 링크, `app/api/webhooks/groble`에서 수강권 발급
- 시청 화면 → 스트리밍 서비스 플레이어 + 서명된 재생 토큰
