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

/** 실명. 공개하지 않는다. */
export function normalizeName(value: unknown): string | null {
  const name = String(value ?? "").trim().replace(/\s+/g, " ");
  return name.length >= 2 && name.length <= 30 ? name : null;
}

/** 닉네임: 한글·영문·숫자·_·. 2~12자. 운영진·서비스 사칭 단어는 막는다 (DB도 같은 규칙) */
export const NICKNAME_PATTERN = "[가-힣A-Za-z0-9_.]{2,12}";
const NICKNAME_RE = new RegExp(`^${NICKNAME_PATTERN}$`);
const RESERVED_NICKNAME = /(운영|관리자|admin|선배클래스|sunbae)/i;

export type NicknameCheck = { ok: true; nickname: string } | { ok: false; reason: "format" | "reserved" };

export function checkNickname(value: unknown): NicknameCheck {
  const nickname = String(value ?? "").trim();
  if (!NICKNAME_RE.test(nickname)) return { ok: false, reason: "format" };
  if (RESERVED_NICKNAME.test(nickname)) return { ok: false, reason: "reserved" };
  return { ok: true, nickname };
}

/** 학번 → "24학번" */
export function admissionLabel(studentId: string): string {
  return `${studentId.slice(2, 4)}학번`;
}

/**
 * 고려대 구글 계정 이름에서 이름·학적 정보 읽기. 예: "홍길동[ 학부재학 / 컴퓨터학과 ]"
 * 입력 칸을 미리 채우는 용도로만 쓴다. 저장은 사용자가 확인하고 제출한 값만.
 */
export function parseSchoolAccountName(
  value: unknown,
): { name: string | null; status: string | null; major: string | null } | null {
  if (typeof value !== "string") return null;
  // 구글 계정 이름 앞에 보이지 않는 문자(zero-width)가 붙어 오는 경우가 있다
  const text = value.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
  const m = text.match(/^(.*?)\s*\[\s*([^/\]]+?)\s*\/\s*([^\]]+?)\s*\]\s*$/);
  if (!m) return { name: normalizeName(text), status: null, major: null };
  return { name: normalizeName(m[1]), status: m[2], major: m[3] };
}
