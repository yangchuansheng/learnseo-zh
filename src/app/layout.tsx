import type { Metadata } from "next";
import { Mukta } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const mukta = Mukta({
  variable: "--font-mukta",
  subsets: ["latin"],
  weight: ["300", "400", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://learningseo.io"),
  title: "用免费资源与工具学习 SEO：完整学习路线图",
  description:
    "LearningSEO.io 提供完整的 SEO 学习路线图，汇集可靠的免费指南、工具与实用建议，帮助你系统提升 SEO 能力。",
  alternates: {
    languages: {
      "zh-CN": "https://learningseo.io/",
      en: "https://learningseo.io/en/",
    },
  },
  icons: {
    icon: "/sites/learningseo-io-071dae18/shared/favicon-32x32.jpg",
    apple: "/sites/learningseo-io-071dae18/shared/apple-touch-icon.jpg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = (await headers()).get("x-learningseo-locale") === "en" ? "en" : "zh-CN";

  return (
    <html lang={locale} className={`${mukta.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
