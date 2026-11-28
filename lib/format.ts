import type { Course, Instructor, Lecture } from "./types";

/** "컴퓨터학과 24학번". 학번이 없으면 학과만. */
export function instructorMeta(instructor: Pick<Instructor, "major" | "admissionYear">) {
  return instructor.admissionYear === null
    ? instructor.major
    : `${instructor.major} ${instructor.admissionYear}학번`;
}

/** 목록·이동 링크에 쓰는 과목 이름. 대학 수업은 학수번호와 교수님까지 붙인다. */
export function courseLabel(course: Course) {
  return course.kind === "major"
    ? `${course.code} ${course.name}, ${course.professor} 교수님`
    : course.name;
}

/** 운영자 표 같은 좁은 칸용 짧은 과목 이름 */
export function courseShortLabel(course: Course) {
  return course.kind === "major" ? `${course.code} ${course.name} (${course.professor})` : course.name;
}

export function totalMinutes(lecture: Pick<Lecture, "chapters">) {
  return lecture.chapters.reduce((sum, c) => sum + c.minutes, 0);
}

export function won(amount: number) {
  return `${amount.toLocaleString("ko-KR")}원`;
}

export function minutesLabel(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}분`;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

export function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00+09:00`);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * 기준 연도(현재 학년도). 페이지를 미리 렌더링하므로 new Date() 대신 상수로 둔다.
 * 실제 서비스에서는 학기 설정값(DB)에서 가져오면 된다.
 */
export const CURRENT_YEAR = 2026;

/** "12월 16일". 기준 연도가 아니면 "2027년 3월 7일"처럼 연도를 붙인다. */
export function koDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const md = `${m}월 ${d}일`;
  return y === CURRENT_YEAR ? md : `${y}년 ${md}`;
}

/** 후기 본문 최대 길이 (DB 제약 reviews_body_length와 같다) */
export const REVIEW_MAX = 1000;
export const QUESTION_MAX = 2000;
export const ANSWER_MAX = 4000;

const kstDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" });

/** DB 시각(timestamptz)을 한국 날짜로: "11월 24일" */
export function koDateOf(timestamp: string) {
  return koDate(kstDay.format(new Date(timestamp)));
}

export const OPTION_LABEL = { video: "영상 강의", study: "스터디반" } as const;

/** 강사 몫(%). 실제 정산 금액은 DB 트리거(private.prepare_settlement)가 같은 비율로 계산한다 */
export const INSTRUCTOR_SHARE_PERCENT = 80;

/** 강사 몫 (원 단위 버림) */
export function instructorShare(gross: number) {
  return Math.floor((gross * INSTRUCTOR_SHARE_PERCENT) / 100);
}

/** 정산 달 "2026-12" → "2026년 12월" */
export function periodLabel(period: string) {
  const [y, m] = period.split("-").map(Number);
  return `${y}년 ${m}월`;
}

/** 지금 한국 날짜 (YYYY-MM-DD). 요청 처리 중에만 부른다(프리렌더 중 금지) */
export function kstToday() {
  return kstDay.format(new Date());
}
