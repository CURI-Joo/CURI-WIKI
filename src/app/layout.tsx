import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "CURI Wiki — 사내 지식 허브",
  description: "CURI AI의 프로젝트와 기술 지식을 한 곳에서 관리하는 사내 위키",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full bg-background text-text-primary">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
