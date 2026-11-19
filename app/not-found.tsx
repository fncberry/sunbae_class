import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-24">
      <h1 className="font-serif text-3xl font-bold">없는 페이지예요</h1>
      <p className="mt-3 text-ink-soft">주소가 바뀌었거나 강의가 내려갔을 수 있어요.</p>
      <Link href="/" className="mt-8 inline-block rounded-ui bg-ink px-5 py-3 text-sm font-semibold text-paper">
        과목 찾기로 가기
      </Link>
    </div>
  );
}
