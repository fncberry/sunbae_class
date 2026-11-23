// 온보딩 입력 규칙. 같은 규칙을 DB 제약(20261123102103_onboarding)도 검사한다.

/** 고려대 학번: 입학 연도 4자리 + 6자리 (예: 2024320001) */
export const STUDENT_ID_PATTERN = "(19|20)[0-9]{8}";
const STUDENT_ID_RE = new RegExp(`^${STUDENT_ID_PATTERN}$`);

export function normalizeStudentId(value: unknown): string | null {
  const id = String(value ?? "").replace(/[\s-]/g, "");
  return STUDENT_ID_RE.test(id) ? id : null;
}

export function normalizeMajor(value: unknown): string | null {
  const major = String(value ?? "").trim().replace(/\s+/g, " ");
  return major.length >= 2 && major.length <= 40 ? major : null;
}

/** 학번 → "24학번" */
export function admissionLabel(studentId: string): string {
  return `${studentId.slice(2, 4)}학번`;
}

/**
 * 고려대 구글 계정 이름에서 학적 정보 읽기. 예: "홍길동[ 학부재학 / 컴퓨터학과 ]"
 * 형식이 다르면 null. 입력 칸을 미리 채우는 용도로만 쓰고 저장하지 않는다.
 */
export function parseSchoolAccountName(name: unknown): { status: string; major: string } | null {
  if (typeof name !== "string") return null;
  const m = name.match(/\[\s*([^/\]]+?)\s*\/\s*([^\]]+?)\s*\]/);
  if (!m) return null;
  return { status: m[1], major: m[2] };
}
