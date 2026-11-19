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
