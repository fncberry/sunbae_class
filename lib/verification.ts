// 성적 인증 신청에서 브라우저와 서버가 같이 쓰는 규칙

export const PROOF_BUCKET = "grade-proofs";
export const PROOF_MAX_BYTES = 10 * 1024 * 1024;

const PROOF_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const PROOF_ACCEPT = Object.keys(PROOF_TYPES).join(",");

/** 올릴 수 있는 파일이면 확장자, 아니면 오류 문구 */
export function checkProofFile(file: { type: string; size: number }): { ok: true; ext: string } | { ok: false; message: string } {
  const ext = PROOF_TYPES[file.type];
  if (!ext) return { ok: false, message: "jpg, png, webp 이미지나 PDF만 올릴 수 있어요." };
  if (file.size > PROOF_MAX_BYTES) return { ok: false, message: "10MB 이하 파일만 올릴 수 있어요." };
  if (file.size === 0) return { ok: false, message: "빈 파일이에요. 다시 골라 주세요." };
  return { ok: true, ext };
}

/** 캡처 경로: {사용자 id}/{신청 id}.{확장자}. Storage 정책과 DB 트리거가 같은 모양을 검사한다. */
export function proofPath(userId: string, verificationId: string, ext: string) {
  return `${userId}/${verificationId}.${ext}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** 서버에서 신청 id와 경로가 이 사용자 것인지 확인한다 */
export function parseProofPath(userId: string, verificationId: string, path: string): boolean {
  if (!UUID.test(verificationId)) return false;
  const m = path.match(/^([^/]+)\/([^/.]+)\.(jpg|png|webp|pdf)$/);
  return !!m && m[1] === userId && m[2] === verificationId;
}

/** 학수번호: 영문 4자 + 숫자 3자 (예: COSE213). 대소문자는 대문자로 맞춘다 */
export function normalizeCourseCode(raw: string): string | null {
  const code = raw.replace(/\s+/g, "").toUpperCase();
  return /^[A-Z]{2,6}[0-9]{3,4}[A-Z]?$/.test(code) ? code : null;
}

export function clean(raw: FormDataEntryValue | null, max: number): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}
