// 화면이 데이터를 가져가는 유일한 입구. 함수 이름과 반환 타입을 유지해야 페이지·컴포넌트를 고치지 않아도 된다.
//
// - 공개 카탈로그: Supabase(anon 역할, RLS 적용)에서 읽고 "use cache" + cacheTag("catalog")로 캐시한다.
//   강의가 승인·수정되면 revalidateTag("catalog")로 갱신한다.
// - 강사 센터·운영자: 로그인한 사람마다 다른 데이터라 3단계(인증)에서 Supabase로 옮긴다. 지금은 목업.

import { cacheLife, cacheTag } from "next/cache";
import * as mock from "./mock-data";
import { publicSupabase } from "./supabase/public";
import type { Tables } from "./database.types";
import type {
  CatalogCourse,
  Course,
  Instructor,
  Lecture,
  LectureStatus,
  LectureWithRelations,
  MonthlySales,
  Review,
  VerificationRequest,
} from "./types";

// ─── DB 행 → 화면 타입 ──────────────────────────────────────

const STATUS_LABEL: Record<Tables<"lectures">["status"], LectureStatus> = {
  draft: "초안",
  reviewing: "검수 중",
  on_sale: "판매 중",
  hidden: "숨김",
  rejected: "반려",
};

const kstDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });

function toCourse(row: Tables<"courses">): Course {
  return {
    id: row.id,
    kind: row.kind,
    code: row.code ?? undefined,
    name: row.name,
    professor: row.professor ?? undefined,
    semester: row.semester ?? undefined,
    group: row.group_name,
    department: row.department ?? undefined,
    students: row.students ?? undefined,
    examDate: row.exam_date,
    examLabel: row.exam_label,
  };
}

type LectureRow = Tables<"lectures"> & {
  course: Tables<"courses">;
  instructor: Tables<"instructors"> & { grade_verifications: Tables<"grade_verifications">[] };
  chapters: Tables<"chapters">[];
};

// 강의 + 과목 + 강사(+ 이 과목 성적 인증) + 목차를 한 번에 가져온다
const LECTURE_SELECT = `
  *,
  course:courses!inner(*),
  instructor:instructors!inner(*, grade_verifications(*)),
  chapters(*)
` as const;

/**
 * 강의 카드에 붙는 강사 정보는 "그 강의 과목"의 승인된 성적 인증 기준이다.
 * 승인된 인증이 없으면 성적 배지를 붙일 수 없으므로 null을 돌려주고, 목록에서 뺀다.
 */
function toLecture(row: LectureRow): LectureWithRelations | null {
  const verification = row.instructor.grade_verifications.find(
    (v) => v.course_id === row.course_id && v.status === "approved",
  );
  if (!verification) return null;

  const instructor: Instructor = {
    id: row.instructor.id,
    name: row.instructor.name,
    major: row.instructor.major,
    admissionYear: row.instructor.admission_year,
    grade: verification.grade,
    verifiedCourseId: verification.course_id,
    verifiedSemester: verification.semester_label,
    proof: verification.proof_text ?? "",
    bio: row.instructor.bio,
  };

  const chapters = [...row.chapters]
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ title: c.title, minutes: c.minutes, preview: c.is_preview || undefined }));

  const studyGroup =
    row.study_group_price !== null && row.study_group_capacity !== null
      ? {
          price: row.study_group_price,
          capacity: row.study_group_capacity,
          remaining: Math.max(0, row.study_group_capacity - row.study_group_taken),
        }
      : undefined;

  return {
    id: row.id,
    courseId: row.course_id,
    instructorId: row.instructor_id,
    title: row.title,
    summary: row.summary,
    price: row.price,
    studyGroup,
    chapters,
    covers: row.covers,
    rating: row.review_count ? Math.round((row.rating_sum / row.review_count) * 10) / 10 : 0,
    reviewCount: row.review_count,
    sales: row.sales_count,
    status: STATUS_LABEL[row.status],
    course: toCourse(row.course),
    instructor,
  };
}

function toLectures(rows: LectureRow[]): LectureWithRelations[] {
  return rows.map(toLecture).filter((l): l is LectureWithRelations => l !== null);
}

function fail(what: string, error: { message: string }): never {
  throw new Error(`${what} 조회 실패: ${error.message}`);
}

// ─── 공개 카탈로그 ──────────────────────────────────────────

export async function listCourses(): Promise<Course[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const { data, error } = await publicSupabase().from("courses").select("*").order("kind").order("id");
  if (error) fail("과목 목록", error);
  return data.map(toCourse);
}

export async function getCourse(id: string): Promise<Course | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const { data, error } = await publicSupabase().from("courses").select("*").eq("id", id).maybeSingle();
  if (error) fail(`과목 ${id}`, error);
  return data ? toCourse(data) : null;
}

/** 과목 찾기 화면: 과목마다 판매 중인 강의 수와 최저가를 붙인다. */
export async function listCatalogCourses(): Promise<CatalogCourse[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  // anon은 RLS 때문에 판매 중 강의만 보인다
  const [courses, lectures] = await Promise.all([listCourses(), listOnSaleLectures()]);
  return courses.map((c) => {
    const prices = lectures.filter((l) => l.courseId === c.id).map((l) => l.price);
    return { ...c, lectureCount: prices.length, minPrice: prices.length ? Math.min(...prices) : null };
  });
}

/** 판매 중 강의 전체, 판매 수 많은 순 */
async function listOnSaleLectures(): Promise<LectureWithRelations[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const { data, error } = await publicSupabase()
    .from("lectures")
    .select(LECTURE_SELECT)
    .eq("status", "on_sale")
    .order("sales_count", { ascending: false })
    .order("id")
    .overrideTypes<LectureRow[], { merge: false }>();
  if (error) fail("강의 목록", error);
  return toLectures(data);
}

/** 판매 수 기준 상위 강의 */
export async function listPopularLectures(limit: number): Promise<LectureWithRelations[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return (await listOnSaleLectures()).slice(0, limit);
}

export async function listLecturesByCourse(courseId: string): Promise<LectureWithRelations[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return (await listOnSaleLectures()).filter((l) => l.courseId === courseId);
}

/** 판매 중인 강의 id 전체 (generateStaticParams용) */
export async function listLectureIds(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return (await listOnSaleLectures()).map((l) => l.id);
}

export async function getLecture(id: string): Promise<LectureWithRelations | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const { data, error } = await publicSupabase()
    .from("lectures")
    .select(LECTURE_SELECT)
    .eq("id", id)
    .overrideTypes<LectureRow[], { merge: false }>();
  if (error) fail(`강의 ${id}`, error);
  return data[0] ? toLecture(data[0]) : null;
}

export async function listReviews(lectureId: string): Promise<Review[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const { data, error } = await publicSupabase()
    .from("reviews")
    .select("*")
    .eq("lecture_id", lectureId)
    .order("created_at", { ascending: false });
  if (error) fail(`강의 ${lectureId} 후기`, error);
  return data.map((r) => ({
    lectureId: r.lecture_id,
    author: r.author_label,
    rating: r.rating,
    text: r.body,
    date: kstDate.format(new Date(r.created_at)),
  }));
}

// ─── 강사 센터 (로그인한 강사 기준, 캐시하지 않음) ──────────────
// TODO(3단계 인증): 세션의 user_id → instructors → lectures·grade_verifications·orders로 교체

export type InstructorDashboard = {
  instructor: Instructor;
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
// TODO(3단계 인증): 운영자 세션으로 grade_verifications(status='pending') 조회로 교체

export type VerificationRow = VerificationRequest & { course: Course };

export async function listVerificationRequests(): Promise<VerificationRow[]> {
  return mock.verificationQueue.map((v) => {
    const course = mock.courses.find((c) => c.id === v.courseId);
    if (!course) throw new Error(`인증 신청 ${v.id}의 과목이 없어요`);
    return { ...v, course };
  });
}
