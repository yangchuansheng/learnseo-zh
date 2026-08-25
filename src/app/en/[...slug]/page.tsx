import type { Metadata } from "next";

import {
  generateSubpageMetadata,
  generateSubpageStaticParams,
  renderSubpagePage,
  type SubpageParams,
} from "@/components/sites/learningseo-io-071dae18/subpages/route";

export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string[] }> {
  return generateSubpageStaticParams("en");
}

export function generateMetadata({ params }: { params: SubpageParams }): Promise<Metadata> {
  return generateSubpageMetadata("en", params);
}

export default function EnglishSubpagePage({ params }: { params: SubpageParams }) {
  return renderSubpagePage("en", params);
}
