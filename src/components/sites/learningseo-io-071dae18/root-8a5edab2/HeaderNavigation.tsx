"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { LearningSeoLogo } from "@/components/sites/learningseo-io-071dae18/shared/Brand";
import { localHref } from "@/components/sites/learningseo-io-071dae18/shared/links";
import { localizedPath, resolveLocalizedPath, type Locale } from "@/lib/localization";
import { usePathname } from "next/navigation";
import englishManifest from "../subpages/generated/manifest.json";
import chineseManifest from "../subpages/generated/manifest.zh-CN.json";

const assetRoot = "/sites/learningseo-io-071dae18/shared";

export type HeaderContent = {
  menuTitle: string;
  navigation: ReadonlyArray<{
    children: ReadonlyArray<{ href: string; label: string }>;
    href: string;
    label: string;
  }>;
  social: ReadonlyArray<{ href: string; label: string }>;
};

const socialIcons: Record<string, string> = {
  facebook: `${assetRoot}/facebook-circle.svg`,
  instagram: `${assetRoot}/instagram-circle.svg`,
  linkedin: `${assetRoot}/linkedin-circle.svg`,
  twitter: `${assetRoot}/twitter-circle.svg`,
  youtube: `${assetRoot}/youtube-circle.svg`,
};
const socialIconNames = ["facebook", "twitter", "instagram", "youtube", "linkedin"];
const availableLocalizedPaths = new Set([
  ...englishManifest.routes.map((route) => localizedPath(route.sourcePath, "en")),
  ...chineseManifest.routes.map((route) => localizedPath(route.sourcePath, "zh-CN")),
]);

export function HeaderNavigation({
  header,
  locale = "zh-CN",
}: {
  header: HeaderContent;
  locale?: Locale;
}) {
  const [activeSubmenu, setActiveSubmenu] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname() || "/";
  const alternateLocale: Locale = locale === "en" ? "zh-CN" : "en";

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 100);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setSearchOpen(false);
        setActiveSubmenu(null);
      }
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const closeMenu = () => {
    setMenuOpen(false);
    setActiveSubmenu(null);
  };

  const toggleMenu = () => {
    setMenuOpen((open) => !open);
    setActiveSubmenu(null);
    setSearchOpen(false);
  };

  const submenu = activeSubmenu === null ? null : header.navigation[activeSubmenu];

  return (
    <header
      id="header"
      className={`left-0 right-0 top-0 z-[100] mx-auto flex items-center justify-between ${
        scrolled
          ? "fixed w-full max-w-none bg-[#f2f2f2] px-3 py-[10px] shadow-[0_1px_10px_rgba(0,0,0,0.07)]"
          : "absolute w-[calc(100%_-_40px)] py-5 md:max-w-[1267px] md:pt-10 md:pb-20 lg:w-[88%] xl:pt-20 xl:pb-[120px]"
      }`}
    >
      <Link
        href={localHref("/", locale)}
        aria-label={locale === "en" ? "LearningSEO.io home" : "LearningSEO.io 首页"}
        className="relative z-0 block text-[#000036]"
      >
        <LearningSeoLogo className="block text-[21.7px] leading-[29px] tracking-[-0.4px] [&_small]:ml-px [&_small]:text-[11px] md:text-[29.75px] md:leading-[29.75px] md:[&_small]:text-[17px]" />
      </Link>

      <div className="flex items-center">
        <a
          className="mr-2 inline text-[12px] font-semibold text-[#303030] underline"
          href={resolveLocalizedPath(pathname, alternateLocale, availableLocalizedPaths)}
          lang={alternateLocale}
          aria-label={alternateLocale === "en" ? "Switch to English" : "切换到简体中文"}
        >
          {alternateLocale === "en" ? "English" : "简体中文"}
        </a>

        <SearchForm open={searchOpen} scrolled={scrolled} locale={locale} />

        <button
          type="button"
            aria-label={locale === "en" ? "Toggle search" : "切换搜索"}
          aria-expanded={searchOpen}
          onClick={() => {
            setSearchOpen((open) => !open);
            closeMenu();
          }}
          className={`flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-[4px] md:hidden ${
            searchOpen ? "bg-white" : "bg-[#ededed]"
          }`}
        >
          <Image src={`${assetRoot}/lupa.svg`} alt="" width={14} height={14} />
        </button>

        <div className="relative ml-[10px]">
          <button
            type="button"
            aria-label={
              menuOpen
                ? locale === "en"
                  ? "Close navigation"
                  : "关闭导航"
                : locale === "en"
                  ? "Open navigation"
                  : "打开导航"
            }
            aria-expanded={menuOpen}
            aria-controls="learning-seo-navigation"
            onClick={toggleMenu}
            className={`flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-[4px] text-[15.3px] font-semibold uppercase leading-[38px] tracking-[2.125px] text-[#303030] transition-colors duration-200 md:w-[110px] md:px-4 ${
              menuOpen ? "bg-white shadow-[0_0_10px_rgba(0,0,0,0.07)]" : "bg-[#ededed] hover:bg-white"
            }`}
          >
            <span className="hidden md:block">{locale === "en" ? "Menu" : "菜单"}</span>
            <MenuGlyph open={menuOpen} />
          </button>

          {menuOpen ? (
            <nav
              id="learning-seo-navigation"
              aria-label={locale === "en" ? "Learning SEO roadmap" : "SEO 学习路线图"}
              className="absolute right-0 top-[120%] h-[510px] w-[calc(100vw_-_40px)] overflow-hidden rounded-[4px] bg-white py-[25px] shadow-[0_0_10px_rgba(0,0,0,0.07)] md:h-[582px] md:w-[500px] md:py-10"
            >
              <div className="relative h-full">
                <h2 className="px-5 pb-3 text-[16.8px] leading-[21px] text-[#a87be9] md:px-10 md:pb-[10px] md:text-[20.4px] md:leading-[24px]">
                  {header.menuTitle}
                </h2>

                {submenu ? (
                  <Submenu
                    label={submenu.label}
                    links={submenu.children}
                    locale={locale}
                    onBack={() => setActiveSubmenu(null)}
                  />
                ) : (
                  <>
                    <ul>
                      {header.navigation.map((item, index) => (
                        <li key={item.href} className="relative m-0 p-0 hover:bg-[#fafafa]">
                          <a
                            href={localHref(item.href, locale)}
                            className="block border-b border-[#ededed] py-2 pr-10 pl-5 text-[12.6px] leading-[14px] tracking-[0.7px] text-[#303030] md:px-10 md:text-[14.96px] md:leading-4 md:tracking-[0.85px]"
                          >
                            {item.label}
                          </a>
                          {item.children.length > 0 ? (
                            <button
                              type="button"
                              aria-label={locale === "en" ? `Open ${item.label} submenu` : `打开${item.label}子菜单`}
                              onClick={() => setActiveSubmenu(index)}
                              className="absolute top-0 right-0 flex h-full w-[30px] cursor-pointer items-center justify-center bg-[#fafafa]"
                            >
                              <Image
                                src={`${assetRoot}/arrow-accordion.svg`}
                                alt=""
                                width={9}
                                height={8}
                                className="-rotate-90"
                              />
                            </button>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                    <SocialLinks items={header.social} />
                  </>
                )}
              </div>
            </nav>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function SearchForm({
  open,
  scrolled,
  locale,
}: {
  open: boolean;
  scrolled: boolean;
  locale: Locale;
}) {
  return (
    <form
      role="search"
      action={localHref("/", locale)}
      method="get"
      className={`absolute z-10 md:relative md:top-auto md:left-auto md:block md:w-[288px] ${
        scrolled ? "top-[10px] left-[10px] w-[calc(100%_-_70px)]" : "top-5 left-0 w-[calc(100%_-_44px)]"
      } ${open ? "block" : "hidden"}`}
    >
      <label className="sr-only" htmlFor="learning-seo-search">
        {locale === "en" ? "Search LearningSEO.io" : "搜索 LearningSEO.io"}
      </label>
      <input
        id="learning-seo-search"
        name="s"
        type="search"
        className="h-[38px] w-full rounded-[4px] border-0 bg-white px-[13px] text-[12.6px] leading-[38px] text-[#606060] outline-0 md:min-w-[288px] md:px-[14.45px] md:text-[15.3px]"
      />
      <button
        type="submit"
        aria-label={locale === "en" ? "Submit search" : "提交搜索"}
        className="absolute top-0 right-0 flex h-[38px] w-[46px] cursor-pointer items-center justify-center"
      >
        <Image src={`${assetRoot}/lupa.svg`} alt="" width={14} height={14} />
      </button>
    </form>
  );
}

function MenuGlyph({ open }: { open: boolean }) {
  return (
    <span className="relative block h-[10px] w-[18px] md:ml-2" aria-hidden="true">
      {open ? (
        <>
          <span className="absolute top-[4px] left-0 h-px w-full rotate-45 bg-[#303030]" />
          <span className="absolute top-[4px] left-0 h-px w-full -rotate-45 bg-[#303030]" />
        </>
      ) : (
        <>
          <span className="absolute top-0 left-0 h-px w-full bg-[#303030]" />
          <span className="absolute top-[4px] left-0 h-px w-full bg-[#303030]" />
          <span className="absolute top-2 left-0 h-px w-full bg-[#303030]" />
        </>
      )}
    </span>
  );
}

function Submenu({
  label,
  links,
  locale,
  onBack,
}: {
  label: string;
  links: ReadonlyArray<{ label: string; href: string }>;
  locale: Locale;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        aria-label={locale === "en" ? `Back from ${label}` : `返回${label}`}
        className="absolute top-[-25px] right-0 flex h-[50px] w-[50px] cursor-pointer items-center justify-center rounded-bl-[4px] bg-[#fafafa] md:top-[-40px]"
      >
        <span className="ml-2 block h-4 w-4 -rotate-45 border-t-2 border-l-2 border-[#9c9ba0]" aria-hidden="true" />
      </button>
      <ul>
        {links.map((link, index) => (
          <li key={link.href} className="m-0 p-0 hover:bg-[#fafafa]">
            <a
              href={localHref(link.href, locale)}
              className={`block border-b border-[#ededed] py-2 pr-10 pl-10 text-[12.6px] leading-[14px] tracking-[0.7px] md:text-[14.96px] md:leading-4 md:tracking-[0.85px] ${
                index === 0 ? "font-bold text-[#000036]" : "text-[#303030]"
              }`}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SocialLinks({
  items,
}: {
  items: HeaderContent["social"];
}) {
  return (
    <ul className="flex gap-[10px] pt-4 pl-5 md:pt-5 md:pl-10">
      {items.map((item, index) => (
        <li key={item.href} className="m-0 p-0">
          <a
            href={item.href}
            aria-label={item.label}
            className="block h-7 w-7 overflow-hidden rounded-full md:h-8 md:w-8"
          >
            <Image
              src={socialIcons[item.label.toLowerCase()] || socialIcons[socialIconNames[index]]}
              alt=""
              width={32}
              height={32}
              className="h-full w-full"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}
