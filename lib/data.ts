// 화면이 데이터를 가져가는 유일한 입구. 함수 이름과 반환 타입을 유지해야 페이지·컴포넌트를 고치지 않아도 된다.
//
// - 공개 카탈로그: Supabase(anon 역할, RLS 적용)에서 읽고 "use cache" + cacheTag("catalog")로 캐시한다.
//   강의·인증이 승인되면 서버 액션에서 updateTag("catalog")로 갱신한다.
// - 강사 센터·운영자 화면은 사람마다 다른 데이터라 lib/instructor-center.ts, lib/admin.ts에서 캐시 없이 읽는다.

import { cacheLife, cacheTag } from "next/cache";
import { publicSupabase } from "./supabase/public";
import type { Tables } from "./database.types";
import type {
  Course,
  Instructor,
  InstructorProfile,
  LectureStatus,
  LectureWithRelations,
  Review,
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

export function toCourse(row: Tables<"courses">): Course {
  return {
    id: row.id,
    kind: row.kind,
    code: row.code ?? undefined,
    name: row.name,
    professor: row.professor ?? undefined,
    semester: row.semester ?? undefined,
    // 마이그레이션(course_track) 적용 전 DB에서도 동작하도록, 대학 수업에 값이 없으면 전공으로 본다
    track: row.kind === "major" ? (row.track ?? "major") : undefined,
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
    verifiedCourseId: row.course_id,
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

/** 강의 목록 화면(과목 찾기)에 쓰는 판매 중 강의 전체 */
export async function listCatalogLectures(): Promise<LectureWithRelations[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return listOnSaleLectures();
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

// ─── 강사 상세 (공개) ───────────────────────────────────────

/** 판매 중 강의가 있는 강사 id (generateStaticParams용) */
export async function listInstructorIds(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  return [...new Set((await listOnSaleLectures()).map((l) => l.instructorId))];
}

/**
 * 강사 공개 프로필. 승인된 인증이 하나도 없으면 null(404).
 * 평균 평점은 강의별 반올림 값이 아니라 rating_sum / review_count 합계로 계산한다.
 */
export async function getInstructorProfile(id: string): Promise<InstructorProfile | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");
  const sb = publicSupabase();

  const [instRes, verRes, counterRes, allLectures] = await Promise.all([
    // user_id(로그인 계정 id)는 공개 화면에 필요 없으므로 가져오지 않는다
    sb.from("instructors").select("id, name, major, admission_year, bio").eq("id", id).maybeSingle(),
    sb
      .from("grade_verifications")
      .select("grade, proof_text, course:courses!inner(*)")
      .eq("instructor_id", id)
      .eq("status", "approved")
      .overrideTypes<{ grade: string; proof_text: string | null; course: Tables<"courses"> }[], { merge: false }>(),
    sb.from("lectures").select("rating_sum, review_count, sales_count").eq("instructor_id", id).eq("status", "on_sale"),
    listOnSaleLectures(),
  ]);
  if (instRes.error) fail(`강사 ${id}`, instRes.error);
  if (verRes.error) fail(`강사 ${id} 인증`, verRes.error);
  if (counterRes.error) fail(`강사 ${id} 강의 지표`, counterRes.error);

  const inst = instRes.data;
  const verifications = verRes.data;
  if (!inst || verifications.length === 0) return null;

  const lectures = allLectures.filter((l) => l.instructorId === id);
  const titles = new Map(lectures.map((l) => [l.id, l.title]));

  let reviews: InstructorProfile["reviews"] = [];
  if (lectures.length > 0) {
    const { data, error } = await sb
      .from("reviews")
      .select("*")
      .in("lecture_id", lectures.map((l) => l.id))
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) fail(`강사 ${id} 후기`, error);
    reviews = data.map((r) => ({
      lectureId: r.lecture_id,
      lectureTitle: titles.get(r.lecture_id) ?? "",
      author: r.author_label,
      rating: r.rating,
      text: r.body,
      date: kstDate.format(new Date(r.created_at)),
    }));
  }

  const ratingSum = counterRes.data.reduce((s, r) => s + r.rating_sum, 0);
  const reviewCount = counterRes.data.reduce((s, r) => s + r.review_count, 0);

  return {
    instructor: {
      id: inst.id,
      name: inst.name,
      major: inst.major,
      admissionYear: inst.admission_year,
      bio: inst.bio,
    },
    verifications: verifications.map((v) => ({
      course: toCourse(v.course),
      grade: v.grade,
      proof: v.proof_text ?? "",
    })),
    lectures,
    reviews,
    stats: {
      rating: reviewCount ? Math.round((ratingSum / reviewCount) * 10) / 10 : null,
      reviewCount,
      students: counterRes.data.reduce((s, r) => s + r.sales_count, 0),
      lectureCount: lectures.length,
    },
  };
}
