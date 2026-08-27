import Image from "next/image";
import Link from "next/link";
import { LearningSeoLogo } from "../shared/Brand";
import { localHref, localHtml } from "../shared/links";
import type { Locale } from "@/lib/localization";
import { getSiteContent, type SiteContent } from "./content";

const socialIconNames = ["facebook", "twitter", "instagram", "youtube", "linkedin"];

export function FooterSection({ content, locale = "zh-CN" }: { content?: SiteContent; locale?: Locale }) {
  const siteContent = content ?? getSiteContent(locale);
  return (
    <>
      <aside
        className="min-h-[92px] bg-[#efe5ff] px-5 py-5 text-center text-[15.4px] leading-[18px] text-[#000036] [&_a]:inline-block [&_a]:border-b-2 [&_a]:border-dashed [&_a]:border-[#000036] [&_a]:pb-[5px] [&_a]:font-bold [&_p]:inline [&_svg]:ml-2.5 [&_svg]:inline-block [&_svg]:h-[26px] [&_svg]:w-6 [&_svg]:translate-y-2 md:min-h-[78px] md:text-[18.7px] md:leading-[21.25px]"
        dangerouslySetInnerHTML={{ __html: localHtml(siteContent.newsletter.html, locale) }}
      />

      <footer className="min-h-[700px] bg-[#000036] px-5 py-10 text-[#f2f2f2] md:min-h-[476px] md:px-0 md:pt-[60px] md:pb-10">
        <div className="flex min-h-[526px] w-[94%] max-w-[1224px] flex-col md:mx-auto md:min-h-[259px] md:w-[88%] md:flex-row">
          <Link
            className="block text-[21px] leading-none text-white md:w-[28.77%] md:pr-10 md:text-[25.5px] xl:w-1/4"
            href={localHref("/", locale)}
            aria-label={locale === "en" ? "LearningSEO.io home" : "LearningSEO.io 首页"}
          >
            <LearningSeoLogo />
          </Link>

          <div className="mt-5 md:my-5 md:w-[32.49%] md:pb-[5px] xl:my-0 xl:w-1/2 xl:pb-0">
            <h2 className="text-[17.5px] leading-[17.5px] font-bold tracking-[.425px] md:text-[21.25px] md:leading-[21.25px] xl:text-[17px]">
              {locale === "en" ? "Roadmap" : "路线图"}
            </h2>
            <nav
              className="mt-3 grid grid-cols-1 gap-y-3 text-sm leading-[14px] font-light md:mt-2.5 md:gap-y-[5px] md:text-[17px] md:leading-[17px] lg:grid-cols-2 xl:gap-y-2.5 xl:text-[14.45px] xl:leading-[15.3px]"
              aria-label={locale === "en" ? "Footer roadmap" : "页脚路线图"}
            >
              {siteContent.footer.navigation.map((item) => (
                <a className="hover:text-[#a87be9]" href={localHref(item.href, locale)} key={item.label}>
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-3 h-8 border-t border-white pt-[5px] text-sm leading-[14px] font-light md:mt-2.5 md:h-auto md:pb-[5px] md:text-[17px] md:leading-[17px] xl:pb-0 xl:text-[14.45px] xl:leading-[21.25px]">
              {siteContent.footer.legal.map((item) => (
                <a href={localHref(item.href, locale)} key={item.label}>
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          <nav
            className="mt-5 h-[66px] md:mt-0 md:h-auto md:w-[38.74%] md:pl-10 xl:w-1/4"
            aria-label={locale === "en" ? "Social media" : "社交媒体"}
          >
            <ul className="max-w-[275px] text-left md:text-right">
              {siteContent.footer.social.map((item, index) => (
                <li className="inline-block" key={item.label}>
                  <a
                    className="mr-2.5 mb-2.5 block h-8 w-8 md:m-2.5"
                    href={item.href}
                    aria-label={item.label}
                  >
                    <Image
                      className="h-8 w-8"
                      src={`/sites/learningseo-io-071dae18/shared/${socialIconNames[index]}-circle.svg`}
                      alt=""
                      width="32"
                      height="32"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <div
          className="relative mx-auto mt-5 min-h-[73.625px] w-full max-w-[1224px] overflow-hidden text-[11.2px] leading-[15.4px] font-semibold tracking-[.4px] [&_.creditos]:mt-2.5 [&_.creditos]:text-white [&_a]:font-bold [&_p]:font-normal [&_svg]:mx-[5px] [&_svg]:inline-block [&_svg]:translate-y-[3px] md:mt-20 md:min-h-0 md:w-[88%] md:text-[13.6px] md:leading-[18.7px] md:[&_.creditos]:absolute md:[&_.creditos]:right-0 md:[&_.creditos]:bottom-1 md:[&_.creditos]:mt-0 xl:leading-[17px]"
          dangerouslySetInnerHTML={{ __html: localHtml(siteContent.footer.copyrightHtml, locale) }}
        />
      </footer>
    </>
  );
}
