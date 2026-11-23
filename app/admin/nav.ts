export function adminNav(active: "verify" | "lectures", counts: { verifications: number; lectures: number }) {
  return [
    { label: `성적 인증 (${counts.verifications})`, href: "/admin", active: active === "verify" },
    { label: `강의 검수 (${counts.lectures})`, href: "/admin/lectures", active: active === "lectures" },
  ];
}
