"use client";

import { useState } from "react";
import type { VerificationRequest } from "@/lib/types";

type Row = VerificationRequest & { courseLabel: string };
type Status = "대기" | "승인" | "반려";

export function VerificationQueue({ rows }: { rows: Row[] }) {
  const [status, setStatus] = useState<Record<string, Status>>(
    Object.fromEntries(rows.map((r) => [r.id, "대기"])),
  );
  const pending = Object.values(status).filter((s) => s === "대기").length;

  return (
    <div>
      <p className="text-sm">
        확인할 신청 <b>{pending}건</b>
        <span className="ml-3 text-ink-soft">승인하거나 반려하면 성적 캡처는 바로 지워져요.</span>
      </p>
      <table className="mt-4 w-full text-[15px]">
        <thead className="text-left text-sm text-ink-soft">
          <tr className="border-b border-ink">
            <th className="py-2.5 font-normal">신청자</th>
            <th className="py-2.5 font-normal">과목</th>
            <th className="py-2.5 font-normal">제출한 결과</th>
            <th className="py-2.5 font-normal">신청일</th>
            <th className="py-2.5 font-normal">캡처</th>
            <th className="py-2.5 text-right font-normal">처리</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const s = status[r.id];
            const done = s !== "대기";
            return (
              <tr key={r.id} className={`border-b border-rule ${done ? "text-ink-faint" : ""}`}>
                <td className="py-4 pr-4">
                  {r.applicant}
                  <span className="block text-sm text-ink-soft">{r.major}</span>
                </td>
                <td className="py-4 pr-4">{r.courseLabel}</td>
                <td className="py-4 pr-4">
                  <b className="font-semibold">{r.grade}</b>
                  <span className="ml-2 text-sm text-ink-soft">{r.semester}</span>
                </td>
                <td className="py-4 pr-4">{r.submittedAt.slice(5).replace("-", "/")}</td>
                <td className="py-4 pr-4">
                  {done ? (
                    <span className="text-sm">지워짐</span>
                  ) : (
                    <button className="text-sm underline underline-offset-4">열어보기</button>
                  )}
                </td>
                <td className="py-4">
                  {done ? (
                    <p className="text-right text-sm font-semibold">{s === "승인" ? "승인함" : "반려함"}</p>
                  ) : (
                    <div className="flex justify-end gap-2 text-sm">
                      <button
                        onClick={() => setStatus((p) => ({ ...p, [r.id]: "반려" }))}
                        className="rounded-ui border border-ink-faint px-3 py-1.5 hover:border-ink"
                      >
                        반려
                      </button>
                      <button
                        onClick={() => setStatus((p) => ({ ...p, [r.id]: "승인" }))}
                        className="rounded-ui bg-ink px-3 py-1.5 font-semibold text-paper hover:bg-ink/85"
                      >
                        승인
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
