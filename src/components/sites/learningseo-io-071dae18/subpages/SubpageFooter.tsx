import Link from "next/link";

import { localHref, localHtml } from "../shared/links";
import type { Locale } from "@/lib/localization";
import type { SiteContent } from "../root-8a5edab2/content";

export function SubpageFooter({
  content,
  locale = "zh-CN",
}: {
  content: SiteContent;
  locale?: Locale;
}) {
  return (
    <>
      <div
        className="newsletter"
        dangerouslySetInnerHTML={{ __html: localHtml(content.newsletter.html, locale) }}
      />

      <footer id="footer" role="contentinfo">
        <div className="footer-content">
          <div className="logo">
            <Link href={localHref("/", locale)} title="LearningSEO.io" rel="home">
              <strong>Learning</strong>SEO<small>.io</small>
            </Link>
          </div>

          <div className="sitemap">
            <h6>{locale === "en" ? "Roadmap" : "路线图"}</h6>
            <div className="sitemap-content">
              <ul className="menu">
                {content.footer.navigation.map((item) => (
                  <li
                    className={item.children.length ? "menu-item-has-children" : undefined}
                    key={item.href}
                  >
                    <a href={localHref(item.href, locale)}>{item.label}</a>
                    {item.children.length ? (
                      <>
                        <ul className="sub-menu">
                          {item.children.map((child) => (
                            <li key={child.href}>
                              <a href={localHref(child.href, locale)}>{child.label}</a>
                            </li>
                          ))}
                        </ul>
                        <button className="open-menu" type="button" aria-label={locale === "en" ? `Open ${item.label}` : `打开${item.label}`} />
                      </>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
            <div className="legales">
              <ul className="menu">
                {content.footer.legal.map((item) => (
                  <li key={item.href}>
                    <a href={localHref(item.href, locale)}>{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="social">
            <ul className="menu">
              {content.footer.social.map((item) => (
                <li className={item.label} key={item.label}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          id="copyright"
          dangerouslySetInnerHTML={{
            __html: localHtml(content.footer.copyrightHtml, locale),
          }}
        />
      </footer>
    </>
  );
}
