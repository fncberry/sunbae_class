import Link from "next/link";

type NavItem = { label: string; href: string; active?: boolean };

export function DashboardShell({
  area,
  nav,
  children,
}: {
  area: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-rule px-6 py-6 md:flex">
        <Link href="/" className="font-serif text-xl font-bold">
          선배클래스
        </Link>
        <p className="mt-8 text-sm text-ink-faint">{area}</p>
        <nav className="mt-3 text-[15px]">
          {nav.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className={`block border-l-2 py-1.5 pl-3 ${
                item.active ? "border-ink font-semibold" : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/" className="mt-auto text-sm text-ink-soft underline-offset-4 hover:underline">
          사이트로 돌아가기
        </Link>
      </aside>
      <div className="flex-1 overflow-x-hidden">{children}</div>
    </div>
  );
}
