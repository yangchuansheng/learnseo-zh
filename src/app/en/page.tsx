import type { Metadata } from "next";

import { HomePage } from "@/components/sites/learningseo-io-071dae18/root-8a5edab2/HomePage";

export const metadata: Metadata = {
  title: "Learn SEO with a Free Roadmap of Reliable Guides & Tools",
  description:
    "LearningSEO.io offers a comprehensive roadmap of reliable free resources, tools, and tips to accelerate your SEO learning process.",
  alternates: {
    canonical: "https://learningseo.io/en/",
    languages: {
      "zh-CN": "https://learningseo.io/",
      en: "https://learningseo.io/en/",
    },
  },
};

export default function EnglishHome() {
  return <HomePage locale="en" />;
}
