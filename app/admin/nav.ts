import type { AdminCounts } from "@/lib/admin";

export function adminNav(active: "verify" | "lectures" | "payments", counts: AdminCounts) {
  return [
    { label: `성적 인증 (${counts.verifications})`, href: "/admin", active: active === "verify" },
    { label: `강의 검수 (${counts.lectures})`, href: "/admin/lectures", active: active === "lectures" },
    { label: `결제 (${counts.payments})`, href: "/admin/payments", active: active === "payments" },
  ];
}
