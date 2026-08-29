import type { Metadata } from "next";

import {
  generateTutorialPageMetadata,
  generateTutorialStaticParams,
  renderTutorialPage,
  type TutorialParams,
} from "@/components/tutorials/route";

export const dynamicParams = false;

export function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return generateTutorialStaticParams("zh-CN");
}

export function generateMetadata({ params }: { params: TutorialParams }): Promise<Metadata> {
  return generateTutorialPageMetadata("zh-CN", params);
}

export default function TutorialPage({ params }: { params: TutorialParams }) {
  return renderTutorialPage("zh-CN", params);
}
