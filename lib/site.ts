// 운영자 정보와 약관 시행일. 이용약관·개인정보처리방침·푸터에서 쓴다.

export const OPERATOR = {
  name: "김민서",
  email: "twehokim@gmail.com",
  privacyOfficer: { name: "김태호", email: "twehokim@gmail.com" },
} as const;

/** 이용약관·개인정보처리방침 시행일 (YYYY-MM-DD). 내용을 바꾸면 새 날짜로 */
export const POLICY_EFFECTIVE_DATE = "2026-11-28";
