import Image from "next/image";
import { ArrowRightIcon } from "../shared/Icons";
import { localHref, localHtml } from "../shared/links";
import type { Locale } from "@/lib/localization";
import { getSiteContent, type SiteContent } from "./content";

export function ResourceBanner({ content, locale = "zh-CN" }: { content?: SiteContent; locale?: Locale }) {
  const banner = (content ?? getSiteContent(locale)).resourceBanner;

  return (
    <section
      className="relative mx-auto mt-10 mb-20 flex w-[98%] overflow-hidden rounded-2xl bg-[linear-gradient(90deg,#2e73ea_77.26%,#22ddd2_117.47%)] py-[7%] pr-[15%] pl-[6%] text-white md:py-[4.5%] xl:min-h-[324.5px] xl:w-full xl:max-w-[1100px] xl:items-start xl:py-[55px] xl:pr-[184px] xl:pl-[73px]"
      aria-label={locale === "en" ? "Google Sheets resources" : "Google Sheets 资源"}
    >
      <Image
        className="absolute top-5 right-5 z-[1] h-[37px] w-10 xl:static xl:h-[66px] xl:w-[71px] xl:shrink-0"
        src="/sites/learningseo-io-071dae18/shared/google-sheets.svg"
        alt=""
        width="71"
        height="66"
      />
      <div className="relative z-[1] grow pl-[5%] xl:pl-[42px]">
        <h2 className="pr-5 text-[17.92px] leading-[21px] font-extrabold md:pr-0 md:text-[34px] md:leading-[38.25px]">
          {banner.title}
        </h2>
        <div
          className="mt-2.5 text-sm leading-[18.9px] md:text-[17px] md:leading-[22.95px]"
          dangerouslySetInnerHTML={{ __html: localHtml(banner.bodyHtml, locale) }}
        />
        <a
          className="mt-[15px] inline-flex items-center gap-[13px] rounded bg-white p-3 text-sm leading-[14px] text-[#2e73ea] hover:shadow-[0_0_8px_rgba(17,58,128,.35)] md:px-4 md:py-3.5 md:text-base md:leading-4"
          href={localHref(banner.href, locale)}
          target="_blank"
          rel="noopener noreferrer"
        >
          {banner.cta}
          <ArrowRightIcon className="text-[#a87be9]" />
        </a>
      </div>
    </section>
  );
}
