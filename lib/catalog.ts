// 과목 찾기(강의 목록) 화면의 카테고리 규칙. 서버·클라이언트 양쪽에서 쓰는 순수 함수만 둔다.
//
// 카테고리 키(URL ?c=)
//   major            전공 전체 (단과대학별 섹션)
//   major:<단과대학>  한 단과대학
//   liberal          교양 전체 (한 목록)
//   cert             자격증·어학 전체
//   cert:<분야>       한 분야

import type { Course, LectureWithRelations } from "./types";

export type CategoryKey = string;
export type Sort = "popular" | "rating" | "price" | "exam";

export const DEFAULT_CATEGORY: CategoryKey = "major";

export const SORT_LABEL: Record<Sort, string> = {
  popular: "많이 팔린 순",
  rating: "평점 높은 순",
  price: "낮은 가격 순",
  exam: "시험 가까운 순",
};

/**
 * 전공 카테고리에 항상 보여줄 단과대학·학부. 강의가 없어도 목록에 0으로 나온다.
 * 이 순서대로 보여주고, 데이터에만 있는 곳은 뒤에 가나다순으로 붙는다.
 */
export const COLLEGES = [
  "경영대학",
  "문과대학",
  "생명과학대학",
  "정경대학",
  "이과대학",
  "공과대학",
  "의과대학",
  "사범대학",
  "간호대학",
  "정보대학",
  "국제대학",
  "미디어대학",
  "보건과학대학",
  "디자인조형학부",
  "자유전공학부",
  "스마트보안학부",
  "심리학부",
  "스마트모빌리티학부",
  "학부대학",
];
const COLLEGE_ORDER = COLLEGES;

export function sortGroups(groups: string[], order: string[] = COLLEGE_ORDER): string[] {
  return [...new Set(groups)].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b, "ko");
  });
}

export function isMajorCourse(c: Course) {
  return c.kind === "major" && c.track !== "liberal";
}
export function isLiberalCourse(c: Course) {
  return c.kind === "major" && c.track === "liberal";
}

/** 카테고리 키에 해당하는 과목인지 */
export function courseInCategory(course: Course, key: CategoryKey): boolean {
  const [root, group] = key.split(":");
  if (root === "major") return isMajorCourse(course) && (!group || course.group === group);
  if (root === "liberal") return isLiberalCourse(course);
  if (root === "cert") return course.kind === "cert" && (!group || course.group === group);
  return false;
}

export function categoryLabel(key: CategoryKey): string {
  const [root, group] = key.split(":");
  if (group) return group;
  if (root === "liberal") return "교양";
  if (root === "cert") return "자격증·어학";
  return "전공";
}

/** 잘못된 키는 기본값으로 */
export function normalizeCategory(raw: string | null, courses: Course[]): CategoryKey {
  if (!raw) return DEFAULT_CATEGORY;
  const [root, group] = raw.split(":");
  if (!["major", "liberal", "cert"].includes(root)) return DEFAULT_CATEGORY;
  if (root === "liberal") return "liberal";
  if (!group) return root;
  // 정해진 단과대학은 강의·과목이 없어도 열 수 있다
  if (root === "major" && COLLEGES.includes(group)) return raw;
  if (!courses.some((c) => courseInCategory(c, raw))) return root;
  return raw;
}

export function sortLectures(lectures: LectureWithRelations[], sort: Sort): LectureWithRelations[] {
  const list = [...lectures];
  switch (sort) {
    case "rating":
      return list.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount);
    case "price":
      return list.sort((a, b) => a.price - b.price || b.sales - a.sales);
    case "exam":
      return list.sort((a, b) => a.course.examDate.localeCompare(b.course.examDate) || b.sales - a.sales);
    default:
      return list.sort((a, b) => b.sales - a.sales);
  }
}

export function matchesQuery(lecture: LectureWithRelations, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const { course, instructor } = lecture;
  return [lecture.title, course.name, course.code, course.professor, course.department, instructor.name]
    .filter(Boolean)
    .some((v) => v!.toLowerCase().includes(q));
}

/**
 * 표지 색. 단과대학·분야마다 하나씩, 흰 글씨가 읽히는 어두운 색만 쓴다.
 * 빨간 펜 색(성적 인증)과 겹치지 않게 붉은 계열은 피했다.
 */
const COVER_COLORS: Record<string, string> = {
  정보대학: "#1e2a44",
  공과대학: "#33475b",
  이과대학: "#24493f",
  경영대학: "#55402f",
  정경대학: "#4b3b63",
  교양: "#7a5a1e",
  어학: "#21495f",
  "IT 자격증": "#2e3036",
};

export function coverColor(course: Course): string {
  return COVER_COLORS[course.group] ?? "#1e2a44";
}
