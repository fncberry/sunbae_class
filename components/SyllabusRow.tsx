/** 강의계획서처럼 왼쪽에 항목 이름, 오른쪽에 내용이 오는 한 줄 */
export function SyllabusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3 border-t border-rule py-8 sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-8">
      <h2 className="text-sm font-semibold text-ink-soft">{label}</h2>
      <div>{children}</div>
    </section>
  );
}
