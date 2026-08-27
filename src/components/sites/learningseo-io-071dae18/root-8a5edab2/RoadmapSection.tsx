import { RoadmapItem } from "./RoadmapItem";
import { localHref } from "../shared/links";
import type { Locale } from "@/lib/localization";
import { getSiteContent, type SiteContent } from "./content";

type RoadmapSectionProps = {
  activeItemCurrent?: boolean;
  activeItemHref?: string | null;
  activeLinkHref?: string | null;
  content?: SiteContent;
  locale?: Locale;
};

function sameHref(left: string, right: string | null, locale: Locale): boolean {
  return right !== null && localHref(left, locale) === localHref(right, locale);
}

export function RoadmapSection({
  activeItemCurrent = false,
  activeItemHref,
  activeLinkHref,
  content,
  locale = "zh-CN",
}: RoadmapSectionProps) {
  const embedded = activeItemHref !== undefined;
  const siteContent = content ?? getSiteContent(locale);

  return (
    <section
      id="roadmap"
      data-react-roadmap
      aria-labelledby="roadmap-title"
      className="relative my-[42px] -mx-[10px] w-[calc(100%+20px)] overflow-hidden rounded-t-xl md:my-[85px] md:mx-0 md:w-full"
    >
      <div
        aria-hidden="true"
        className="absolute top-[59px] bottom-[30px] left-[25px] z-20 w-[5px] bg-[#a87be9] md:top-[72px] md:bottom-[36px] md:left-[49px]"
      />
      <div
        aria-hidden="true"
        className="absolute top-[48px] left-[17px] z-30 size-[21px] rotate-45 border-[5px] border-[#a87be9] bg-[#f8f8ff] md:top-[60px] md:left-[39px] md:size-[24px] md:border-[6px]"
      />

      <header className="relative h-[171px] bg-[linear-gradient(0deg,#f0f0ff_-32.47%,#fafaff_75.54%)] pt-7 pr-7 pb-[42px] pl-14 md:h-auto md:min-h-[216px] md:pt-[51px] md:pr-[85px] md:pb-[68px] md:pl-[102px] xl:h-[216px] xl:min-h-0">
        <h2
          id="roadmap-title"
          className="mb-[15px] text-[19.6px] leading-[21px] font-bold text-[#303030] md:text-[39.95px] md:leading-[39.95px]"
        >
          {siteContent.roadmap.title}
        </h2>
        <p className="max-w-[632px] text-[14px] leading-[17.5px] text-[#606060] md:text-[17px] md:leading-[21.25px]">
          {siteContent.roadmap.intro}
        </p>
      </header>

      <div className="relative z-10 mt-[-17px] flex flex-col gap-2 pb-[14px] pl-[25px] md:gap-3 md:pb-3 md:pl-[4%]">
        {siteContent.roadmap.items.map((item) => {
          const active = sameHref(item.href, activeItemHref ?? null, locale);
          return (
            <RoadmapItem
              key={item.href}
              {...item}
              activeLinkHref={active ? activeLinkHref : null}
              initiallyOpen={embedded ? active : item.initiallyOpen}
              isCurrent={active && activeItemCurrent}
              locale={locale}
            />
          );
        })}
      </div>
    </section>
  );
}
