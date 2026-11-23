export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-rule">
      <div className="mx-auto grid max-w-6xl gap-2 px-6 py-10 text-sm text-ink-faint md:grid-cols-2">
        <p>
          선배클래스는 더해커톤 고려대 지부에서 만들고 있어요.
          <br />
          결제는 그로블(Groble)이 처리해요.
        </p>
        <p className="md:text-right">지금 보이는 강의와 사람은 모두 예시 데이터예요.</p>
      </div>
    </footer>
  );
}
