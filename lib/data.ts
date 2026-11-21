// 화면이 데이터를 가져가는 유일한 입구.
// 지금은 lib/mock-data.ts를 읽고, Supabase를 붙이면 이 파일의 함수 본문만 바꾼다.
// 함수 이름과 반환 타입은 그대로 두어야 페이지·컴포넌트를 고치지 않아도 된다.
//
// 캐시 규칙 (cacheComponents 사용 중):
// - 누구에게나 똑같이 보이는 카탈로그 데이터 → "use cache" + cacheTag("catalog")
//   강의가 승인·수정되면 revalidateTag("catalog")로 갱신한다.
// - 로그인한 사람마다 다른 데이터(강사 센터, 운영자, 시청 권한) → 캐시하지 않는다.
//   cookies()를 읽는 쪽에서 <Suspense>로 감싸서 요청 시점에 렌더링한다.

import { cacheLife, cacheTag } from "next/cache";
import * as mock from "./mock-data";
import type {
  CatalogCourse,
  Course,
  Lecture,
  LectureWithRelations,
  MonthlySales,
  Review,
  VerificationRequest,
} from "./types";

function withRelations(lecture: Lecture): LectureWithRelations {
  const course = mock.courses.find((c) => c.id === lecture.courseId);
  const instructor = mock.instructors.find((i) => i.id === lecture.instructorId);
  if (!course || !instructor) throw new Error(`강의 ${lecture.id}의 과목 또는 강사가 없어요`);
  return { ...lecture, course, instructor };
}

const onSale = (l: Lecture) => l.status === "판매 중";

// ─── 공개 카탈로그 ──────────────────────────────────────────

export async function listCourses(): Promise<Course[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return mock.courses;
}

export async function getCourse(id: string): Promise<Course | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return mock.courses.find((c) => c.id === id) ?? null;
}

/** 과목 찾기 화면: 과목마다 판매 중인 강의 수와 최저가를 붙인다. */
export async function listCatalogCourses(): Promise<CatalogCourse[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return mock.courses.map((c) => {
    const ls = mock.lectures.filter((l) => l.courseId === c.id && onSale(l));
    return {
      ...c,
      lectureCount: ls.length,
      minPrice: ls.length ? Math.min(...ls.map((l) => l.price)) : null,
    };
  });
}

/** 판매 수 기준 상위 강의 */
export async function listPopularLectures(limit: number): Promise<LectureWithRelations[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return mock.lectures
    .filter(onSale)
    .sort((a, b) => b.sales - a.sales)
    .slice(0, limit)
    .map(withRelations);
}

export async function listLecturesByCourse(courseId: string): Promise<LectureWithRelations[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return mock.lectures
    .filter((l) => l.courseId === courseId && onSale(l))
    .sort((a, b) => b.sales - a.sales)
    .map(withRelations);
}

/** 판매 중인 강의 id 전체 (generateStaticParams용) */
export async function listLectureIds(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return mock.lectures.filter(onSale).map((l) => l.id);
}

export async function getLecture(id: string): Promise<LectureWithRelations | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const lecture = mock.lectures.find((l) => l.id === id);
  return lecture ? withRelations(lecture) : null;
}

export async function listReviews(lectureId: string): Promise<Review[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return mock.reviews.filter((r) => r.lectureId === lectureId);
}

// ─── 강사 센터 (로그인한 강사 기준, 캐시하지 않음) ──────────────

export type InstructorDashboard = {
  instructor: LectureWithRelations["instructor"];
  verifiedCourse: Course;
  lectures: Lecture[];
  monthlySales: MonthlySales[];
  share: number; // 강사 정산 비율
};

/** 목업: 로그인 세션 대신 고정된 강사(정하윤)를 돌려준다. */
export async function getMyInstructorDashboard(): Promise<InstructorDashboard> {
  const instructor = mock.instructors.find((i) => i.id === mock.currentInstructorId);
  if (!instructor) throw new Error("로그인한 강사를 찾을 수 없어요");
  const verifiedCourse = mock.courses.find((c) => c.id === instructor.verifiedCourseId);
  if (!verifiedCourse) throw new Error("인증된 과목을 찾을 수 없어요");
  return {
    instructor,
    verifiedCourse,
    lectures: mock.lectures.filter((l) => l.instructorId === instructor.id),
    monthlySales: mock.monthlySales,
    share: mock.instructorShare,
  };
}

// ─── 운영자 (캐시하지 않음) ─────────────────────────────────

export type VerificationRow = VerificationRequest & { course: Course };

export async function listVerificationRequests(): Promise<VerificationRow[]> {
  return mock.verificationQueue.map((v) => {
    const course = mock.courses.find((c) => c.id === v.courseId);
    if (!course) throw new Error(`인증 신청 ${v.id}의 과목이 없어요`);
    return { ...v, course };
  });
}
