import content from "./content.json";
import { PlaneIcon } from "../shared/Icons";
import { LearningSeoLogo } from "../shared/Brand";

export function FooterSection() {
  const newsletterLead = content.newsletter.text.replace(
    content.newsletter.linkLabel,
    "",
  );

  return (
    <>
      <aside className="flex min-h-[92px] items-center justify-center gap-2 bg-[#efe5ff] px-5 py-5 text-center text-[15.4px] leading-[18px] text-[#000036] md:min-h-[78px] md:text-[18.7px] md:leading-[21.25px]">
        <p>
          {newsletterLead}
          <a
            className="border-b-2 border-dashed border-[#000036] pb-1 font-bold"
            href={content.newsletter.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {content.newsletter.linkLabel}
          </a>
        </p>
        <PlaneIcon className="h-[26px] w-8 shrink-0 text-[#000036]" />
      </aside>

      <footer className="min-h-[700px] bg-[#000036] px-5 py-10 text-[#f2f2f2] md:min-h-[476px] md:px-0 md:pt-[60px] md:pb-10">
        <div className="mx-auto flex min-h-[526px] max-w-[1224px] flex-col md:min-h-[259px] md:flex-row">
          <a
            className="block text-[21px] leading-none text-white md:w-1/4 md:pr-10 md:text-[25.5px]"
            href="https://learningseo.io/"
            aria-label="LearningSEO.io home"
          >
            <LearningSeoLogo />
          </a>

          <div className="mt-5 md:mt-0 md:w-1/2">
            <h2 className="text-[17.5px] font-bold tracking-[.425px] md:text-[17px]">
              Roadmap
            </h2>
            <nav
              className="mt-2.5 grid grid-cols-1 gap-y-3 text-sm font-light leading-[15px] md:grid-cols-2 md:gap-y-3 md:text-[14.45px] md:leading-[15.3px]"
              aria-label="Footer roadmap"
            >
              {content.footer.navigation.map((item) => (
                <a className="hover:text-[#a87be9]" href={item.href} key={item.label}>
                  {item.label}
                </a>
              ))}
            </nav>
            {content.footer.legal.map((item) => (
              <a
                className="mt-5 inline-block border-t border-white/50 pt-3 text-sm underline"
                href={item.href}
                key={item.label}
              >
                {item.label}
              </a>
            ))}
          </div>

          <nav
            className="mt-6 flex h-[66px] items-start gap-2 md:mt-0 md:w-1/4 md:justify-end md:pl-10"
            aria-label="Social media"
          >
            {content.footer.social.map((item) => (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={item.label}
                key={item.label}
              >
                <img
                  className="h-7 w-7"
                  src={`/sites/learningseo-io-071dae18/shared/${item.label}-circle.svg`}
                  alt=""
                  width="28"
                  height="28"
                />
              </a>
            ))}
          </nav>
        </div>

        <div
          className="mx-auto max-w-[1224px] border-t border-white pt-5 text-[11.2px] leading-[15.4px] [&_.creditos]:mt-3 [&_.creditos]:flex [&_.creditos]:items-center [&_.creditos]:gap-1 [&_a]:underline [&_p]:mt-2 [&_svg]:inline-block md:text-[13.6px] md:leading-[17px]"
          dangerouslySetInnerHTML={{ __html: content.footer.copyrightHtml }}
        />
      </footer>
    </>
  );
}
