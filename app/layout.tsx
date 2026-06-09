import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CLAWORLD · Serenity Analysis",
  description: "Claworld 投研终端 · Serenity X 分析输出的动态投研看板",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=Spline+Sans+Mono:wght@400;500;600&display=swap"
        />
        {children}
      </body>
    </html>
  );
}
