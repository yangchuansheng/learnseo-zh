import content from "./content.json";
import { ArrowRightIcon } from "../shared/Icons";

export function ResourceBanner() {
  const banner = content.resourceBanner;

  return (
    <section
      className="relative mx-auto my-10 flex min-h-72 w-[calc(100%-48px)] max-w-[1100px] overflow-hidden rounded-2xl bg-[linear-gradient(90deg,#2e73ea_77.26%,#22ddd2_117.47%)] px-[13px] py-11 text-white md:mt-10 md:mb-20 md:min-h-[325px] md:items-start md:px-[73px] md:py-[55px]"
      aria-label="Google Sheets resources"
    >
      <img
        className="absolute top-5 right-5 h-[37px] w-10 md:static md:h-[66px] md:w-[71px] md:shrink-0"
        src="/sites/learningseo-io-071dae18/shared/google-sheets.svg"
        alt=""
        width="71"
        height="66"
      />
      <div className="pl-[13px] md:max-w-[760px] md:pl-[42px]">
        <h2 className="pr-12 text-[17.92px] leading-[21px] font-extrabold md:pr-0 md:text-[34px] md:leading-[38.25px]">
          {banner.title}
        </h2>
        <div
          className="mt-4 text-sm leading-[18.9px] md:text-[17px] md:leading-[22.95px]"
          dangerouslySetInnerHTML={{ __html: banner.bodyHtml }}
        />
        <a
          className="mt-[15px] inline-flex items-center gap-3 rounded bg-white px-3 py-3 text-sm font-bold text-[#2e73ea] hover:shadow-[0_0_8px_rgba(17,58,128,.35)] md:px-4 md:py-3.5 md:text-base"
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
