// 이용약관·개인정보처리방침 공통 틀

export function LegalDoc({ title, effective, children }: { title: string; effective: string; children: React.ReactNode }) {
  const [y, m, d] = effective.split("-").map(Number);
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-serif text-3xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-ink-faint">
        {y}년 {m}월 {d}일부터 적용
      </p>
      <div className="mt-10 space-y-10 text-[15px] leading-relaxed">{children}</div>
    </article>
  );
}

export function Clause({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-3 space-y-2 text-ink-soft">{children}</div>
    </section>
  );
}

export function Items({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal space-y-1.5 pl-5">{children}</ol>;
}

export function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-sm">
        <thead className="text-left text-ink-faint">
          <tr className="border-b border-ink">
            {head.map((h) => (
              <th key={h} className="py-2 pr-4 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-rule align-top">
              {r.map((c, j) => (
                <td key={j} className="py-2.5 pr-4">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
