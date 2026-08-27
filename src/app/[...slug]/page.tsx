import type { Metadata } from "next";
import {
  generateSubpageMetadata,
  generateSubpageStaticParams,
  renderSubpagePage,
  type SubpageParams,
} from "@/components/sites/learningseo-io-071dae18/subpages/route";

export const dynamicParams = false;

export function generateStaticParams(): Array<{ slug: string[] }> {
  return generateSubpageStaticParams("zh-CN");
}

export async function generateMetadata({
  params,
}: { params: SubpageParams }): Promise<Metadata> {
  return generateSubpageMetadata("zh-CN", params);
}

export default async function SubpagePage({
  params,
}: {
  params: SubpageParams;
}) {
  return renderSubpagePage("zh-CN", params);
}
