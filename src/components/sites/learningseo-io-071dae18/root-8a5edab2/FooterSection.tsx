import content from "./content.json";
import { LearningSeoLogo } from "../shared/Brand";

export function FooterSection() {
  return (
    <>
      <aside
        className="min-h-[92px] bg-[#efe5ff] px-5 py-5 text-center text-[15.4px] leading-[18px] text-[#000036] [&_a]:inline-block [&_a]:border-b-2 [&_a]:border-dashed [&_a]:border-[#000036] [&_a]:pb-[5px] [&_a]:font-bold [&_p]:inline [&_svg]:ml-2.5 [&_svg]:inline-block [&_svg]:h-[26px] [&_svg]:w-6 [&_svg]:translate-y-2 md:min-h-[78px] md:text-[18.7px] md:leading-[21.25px]"
        dangerouslySetInnerHTML={{ __html: content.newsletter.html }}
      />

      <footer className="min-h-[700px] bg-[#000036] px-5 py-10 text-[#f2f2f2] md:min-h-[476px] md:px-0 md:pt-[60px] md:pb-10">
        <div className="flex min-h-[526px] w-[94%] max-w-[1224px] flex-col md:mx-auto md:min-h-[259px] md:w-[88%] md:flex-row">
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
              className="mt-2.5 grid grid-cols-1 gap-y-3 text-sm font-light leading-[15px] md:gap-y-2.5 md:text-[14.45px] md:leading-[15.3px] lg:grid-cols-2"
              aria-label="Footer roadmap"
            >
              {content.footer.navigation.map((item) => (
                <a className="hover:text-[#a87be9]" href={item.href} key={item.label}>
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-2.5 border-t border-white pt-[5px] text-sm font-light md:text-[14.45px]">
              {content.footer.legal.map((item) => (
                <a href={item.href} key={item.label}>
                  {item.label}
                </a>
              ))}
            </div>
          </div>

          <nav
            className="mt-6 h-[66px] md:mt-0 md:w-1/4 md:pl-10"
            aria-label="Social media"
          >
            <ul className="max-w-[275px] text-left md:text-right">
              {content.footer.social.map((item) => (
                <li className="inline-block" key={item.label}>
                  <a
                    className="mr-2.5 mb-2.5 block h-8 w-8 md:m-2.5"
                    href={item.href}
                    aria-label={item.label}
                  >
                    <img
                      className="h-8 w-8"
                      src={`/sites/learningseo-io-071dae18/shared/${item.label}-circle.svg`}
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
          className="relative mx-auto mt-5 w-full max-w-[1224px] overflow-hidden text-[11.2px] leading-[15.4px] font-semibold tracking-[.4px] [&_.creditos]:mt-2.5 [&_.creditos]:text-white [&_a]:font-bold [&_p]:font-normal [&_svg]:mx-[5px] [&_svg]:inline-block [&_svg]:translate-y-[3px] md:mt-20 md:w-[88%] md:text-[13.6px] md:leading-[17px] md:[&_.creditos]:absolute md:[&_.creditos]:right-0 md:[&_.creditos]:bottom-1 md:[&_.creditos]:mt-0"
          dangerouslySetInnerHTML={{ __html: content.footer.copyrightHtml }}
        />
      </footer>
    </>
  );
}
