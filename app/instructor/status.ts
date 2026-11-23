import type { Tables } from "@/lib/database.types";

export const LECTURE_STATUS_TEXT: Record<Tables<"lectures">["status"], string> = {
  draft: "초안",
  reviewing: "검수 중",
  on_sale: "판매 중",
  hidden: "숨김",
  rejected: "반려",
};
