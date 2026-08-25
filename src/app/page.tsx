import type { Metadata } from "next";

import { HomePage } from "@/components/sites/learningseo-io-071dae18/root-8a5edab2/HomePage";

export const metadata: Metadata = {
  title: "用免费资源与工具学习 SEO：完整学习路线图",
  description:
    "LearningSEO.io 提供完整的 SEO 学习路线图，汇集可靠的免费指南、工具与实用建议，帮助你系统提升 SEO 能力。",
  alternates: {
    canonical: "https://learningseo.io/",
    languages: {
      "zh-CN": "https://learningseo.io/",
      en: "https://learningseo.io/en/",
    },
  },
};

export default function Home() {
  return <HomePage locale="zh-CN" />;
}
