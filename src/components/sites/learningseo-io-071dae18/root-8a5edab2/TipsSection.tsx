import { TipCard } from "./TipCard";
import type { Locale } from "@/lib/localization";
import { getSiteContent, type SiteContent } from "./content";
import { localHtml } from "../shared/links";

export function TipsSection({ content, locale = "zh-CN" }: { content?: SiteContent; locale?: Locale }) {
  const siteContent = content ?? getSiteContent(locale);
  return (
    <section className="relative mt-[60px] overflow-hidden bg-[url('/sites/learningseo-io-071dae18/shared/tips.png')] bg-[length:60%_auto] bg-right-top bg-no-repeat py-[60px] before:pointer-events-none before:absolute before:top-0 before:left-0 before:w-full before:pb-[70%] before:bg-[linear-gradient(180deg,rgba(46,115,234,.15)_0%,rgba(46,115,234,0)_79.81%)] md:mx-auto md:mt-[60px] md:w-[calc(88%+40px)] md:bg-auto md:pt-[100px] md:pb-[163.75px] xl:mt-[100px] xl:w-full xl:pb-[100px]">
      <div className="relative mx-auto w-[88%] max-w-[1224px]">
        <h2 className="max-w-[740px] pb-5 text-[35px] leading-[35px] font-extrabold text-[#000036] md:pb-[50px] md:text-[59.5px] md:leading-[59.5px]">
          {siteContent.tips.title}
        </h2>
        <div
          className="max-w-[740px] text-sm leading-[23.8px] [&_a]:text-[#2e73ea] [&_a]:underline md:text-[17px] md:leading-[28.9px]"
          dangerouslySetInnerHTML={{ __html: localHtml(siteContent.tips.introHtml, locale) }}
        />
      </div>

      <div className="relative mx-auto mt-[30px] w-[90%] max-w-[1224px] columns-1 gap-0 min-[600px]:columns-2 min-[960px]:columns-3 md:mt-[50px]">
        {siteContent.tips.items.map((tip) => (
          <TipCard key={tip.id} source={siteContent.source} tip={tip} locale={locale} />
        ))}
      </div>
    </section>
  );
}
