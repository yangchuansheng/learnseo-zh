import Image from "next/image";
import content from "./content.json";
import { ArrowRightIcon } from "../shared/Icons";

export function ResourceBanner() {
  const banner = content.resourceBanner;

  return (
    <section
      className="relative mx-auto mt-10 mb-20 flex w-[88%] max-w-[1100px] overflow-hidden rounded-2xl bg-[linear-gradient(90deg,#2e73ea_77.26%,#22ddd2_117.47%)] py-[24.5px] pr-[52.5px] pl-[21px] text-white md:min-h-[324.5px] md:items-start md:py-[55px] md:pr-[184px] md:pl-[73px]"
      aria-label="Google Sheets resources"
    >
      <Image
        className="absolute top-5 right-5 z-[1] h-[37px] w-10 md:static md:h-[66px] md:w-[71px] md:shrink-0"
        src="/sites/learningseo-io-071dae18/shared/google-sheets.svg"
        alt=""
        width="71"
        height="66"
      />
      <div className="relative z-[1] grow pl-[13.47px] md:pl-[42px]">
        <h2 className="pr-5 text-[17.92px] leading-[21px] font-extrabold md:pr-0 md:text-[34px] md:leading-[38.25px]">
          {banner.title}
        </h2>
        <div
          className="mt-2.5 text-sm leading-[18.9px] md:text-[17px] md:leading-[22.95px]"
          dangerouslySetInnerHTML={{ __html: banner.bodyHtml }}
        />
        <a
          className="mt-[15px] inline-flex items-center gap-[13px] rounded bg-white p-3 text-sm leading-[14px] text-[#2e73ea] hover:shadow-[0_0_8px_rgba(17,58,128,.35)] md:px-4 md:py-3.5 md:text-base md:leading-4"
          href={banner.href}
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
