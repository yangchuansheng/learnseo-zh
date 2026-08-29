import type { Metadata } from "next";

import {
  generateTutorialPageMetadata,
  generateTutorialStaticParams,
  renderTutorialPage,
  type TutorialParams,
} from "@/components/tutorials/route";

export const dynamicParams = false;

export function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return generateTutorialStaticParams("en");
}

export function generateMetadata({ params }: { params: TutorialParams }): Promise<Metadata> {
  return generateTutorialPageMetadata("en", params);
}

export default function EnglishTutorialPage({ params }: { params: TutorialParams }) {
  return renderTutorialPage("en", params);
}
