import Link from "next/link";

import content from "../root-8a5edab2/content.json";

function localHref(href: string): string {
  return href.replace("https://learningseo.io", "") || "/";
}

export function SubpageFooter() {
  return (
    <>
      <div
        className="newsletter"
        dangerouslySetInnerHTML={{ __html: content.newsletter.html }}
      />

      <footer id="footer" role="contentinfo">
        <div className="footer-content">
          <div className="logo">
            <Link href="/" title="LearningSEO.io" rel="home">
              <strong>Learning</strong>SEO<small>.io</small>
            </Link>
          </div>

          <div className="sitemap">
            <h6>Roadmap</h6>
            <div className="sitemap-content">
              <ul className="menu">
                {content.footer.navigation.map((item) => (
                  <li
                    className={item.children.length ? "menu-item-has-children" : undefined}
                    key={item.href}
                  >
                    <a href={localHref(item.href)}>{item.label}</a>
                    {item.children.length ? (
                      <>
                        <ul className="sub-menu">
                          {item.children.map((child) => (
                            <li key={child.href}>
                              <a href={localHref(child.href)}>{child.label}</a>
                            </li>
                          ))}
                        </ul>
                        <button className="open-menu" type="button" aria-label={`Open ${item.label}`} />
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
                    <a href={localHref(item.href)}>{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="social">
            <ul className="menu">
              {content.footer.social.map((item) => (
                <li className={item.label} key={item.label}>
                  <a href={item.href}>Menu Item</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          id="copyright"
          dangerouslySetInnerHTML={{
            __html: content.footer.copyrightHtml.replace(
              /https:\/\/learningseo\.io(?=\/)/g,
              "",
            ),
          }}
        />
      </footer>
    </>
  );
}
