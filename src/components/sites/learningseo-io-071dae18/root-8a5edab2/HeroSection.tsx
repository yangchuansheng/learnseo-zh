import { localHtml } from "@/components/sites/learningseo-io-071dae18/shared/links";
import type { Locale } from "@/lib/localization";
import { getSiteContent, type SiteContent } from "./content";

const animationSource = "/sites/learningseo-io-071dae18/root-8a5edab2/hero-animation.svg";

export function HeroSection({ content, locale = "zh-CN" }: { content?: SiteContent; locale?: Locale }) {
  const siteContent = content ?? getSiteContent(locale);
  return (
    <section className="relative w-full overflow-visible pt-[78px] md:pt-[158px] xl:pt-[238px]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-40px] right-[-35%] z-0 w-[110%] max-w-[450px] overflow-hidden min-[400px]:top-[-10px] min-[400px]:right-[-30%] min-[500px]:top-0 min-[500px]:right-[-20%] min-[575px]:top-[30px] min-[575px]:right-0 min-[575px]:w-1/2 md:hidden lg:top-[120px] lg:right-[-15%] lg:block lg:w-[60%] lg:max-w-none xl:top-[232px] xl:right-0 xl:w-[48%]"
      >
        <object
          data={animationSource}
          type="image/svg+xml"
          tabIndex={-1}
          className="ml-[10%] block h-auto w-[160%] max-w-none"
        >
          LearningSEO.io roadmap animation
        </object>
      </div>

      <article className="relative z-10 mx-auto w-[calc(100%_-_40px)] md:w-[88%] md:max-w-[1224px] min-[1368px]:pl-20">
        <header className="max-w-[850px]">
          <h1
            className="mt-[25px] mb-[15px] max-w-[255px] text-[24.5px] leading-[32.9px] font-extrabold text-[#000036] [&_.color-violeta]:text-[#a87be9] md:mt-0 md:mb-[25px] md:max-w-[70%] md:text-[57.8px] md:leading-[63.75px] lg:max-w-none lg:text-[72px] lg:leading-[84px] xl:text-[76.5px] xl:leading-[89.25px]"
            dangerouslySetInnerHTML={{ __html: siteContent.hero.titleHtml }}
          />
        </header>

        <div className="mt-[15px] mb-5 block h-5 text-[12.6px] leading-5 font-semibold uppercase text-[#606060] md:mt-[25px] md:mb-[50px] md:text-[15.98px]">
          <span className="inline-block h-5 leading-[22px]">{siteContent.hero.version}</span>
          <span className="ml-[5px] inline-block h-5 border-l-2 border-[#a87be9] pl-[5px] leading-[22px] text-[#9c9ba0] md:ml-[15px] md:border-l-[3px] md:pl-[15px]">
            {siteContent.hero.updated}
          </span>
        </div>

        <div className="-mx-[10px] max-w-[850px] rounded-[8px] bg-[#ededed] p-5 text-[14px] leading-[21.28px] [&_.inlinks]:text-[#0000ee] [&_p]:mb-[10px] [&_p:first-child]:mt-0 [&_p:first-child]:text-[16.38px] [&_p:first-child]:leading-[24.64px] md:mx-0 md:bg-transparent md:p-0 md:text-[17px] md:leading-[25.84px] md:[&_p]:mb-[25px] md:[&_p:first-child]:mt-[25px] md:[&_p:first-child]:text-[19.89px] md:[&_p:first-child]:leading-[29.92px]">
          {siteContent.hero.paragraphsHtml.map((paragraph) => (
            <p key={paragraph} dangerouslySetInnerHTML={{ __html: localHtml(paragraph, locale) }} />
          ))}
        </div>
      </article>
    </section>
  );
}
