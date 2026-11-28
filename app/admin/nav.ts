import type { AdminCounts } from "@/lib/admin";

export function adminNav(active: "verify" | "lectures" | "payments" | "settlements", counts: AdminCounts) {
  return [
    { label: `성적 인증 (${counts.verifications})`, href: "/admin", active: active === "verify" },
    { label: `강의 검수 (${counts.lectures})`, href: "/admin/lectures", active: active === "lectures" },
    { label: `결제 (${counts.payments})`, href: "/admin/payments", active: active === "payments" },
    { label: `정산 (${counts.settlements})`, href: "/admin/settlements", active: active === "settlements" },
  ];
}
