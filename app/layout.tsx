import type { Metadata } from "next";
// 폰트는 npm 패키지(@fontsource)로 프로젝트 안에서 서빙해서, 빌드할 때 Google Fonts 접속이 필요 없게 했다.
import "@fontsource/ibm-plex-sans-kr/400.css";
import "@fontsource/ibm-plex-sans-kr/500.css";
import "@fontsource/ibm-plex-sans-kr/600.css";
import "@fontsource/ibm-plex-sans-kr/700.css";
import "@fontsource/hahmlet/500.css";
import "@fontsource/hahmlet/700.css";
import "@fontsource/nanum-pen-script/400.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "선배클래스 | 같은 분반 A+ 선배의 시험 대비 강의",
  description: "교수님·분반 기준으로 정리된 시험 대비 강의를 과목별로 결제해서 듣는 곳",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
