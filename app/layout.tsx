import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Serenity Analysis",
  description: "Serenity X 分析输出的动态投研看板",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
