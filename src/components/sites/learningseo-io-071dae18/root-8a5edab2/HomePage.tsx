import { FaqSection } from "./FaqSection";
import { FooterSection } from "./FooterSection";
import { HeaderNavigation } from "./HeaderNavigation";
import { HeroSection } from "./HeroSection";
import { ResourceBanner } from "./ResourceBanner";
import { RoadmapSection } from "./RoadmapSection";
import { TipsSection } from "./TipsSection";
import { VideoGallery } from "./VideoGallery";
import { getSiteContent } from "./content";
import type { Locale } from "@/lib/localization";

export function HomePage({ locale }: { locale: Locale }) {
  const content = getSiteContent(locale);

  return (
    <div data-learning-seo className="min-h-screen">
      <HeaderNavigation header={content.header} locale={locale} />
      <main className="relative">
        <HeroSection content={content} locale={locale} />
        <div className="mx-auto w-[calc(100%-40px)] max-w-[1224px] md:w-[88%]">
          <RoadmapSection content={content} locale={locale} />
        </div>
        <div className="mx-auto w-[calc(100%-40px)] max-w-[1224px] md:w-[88%]">
          <ResourceBanner content={content} locale={locale} />
        </div>
        <div className="mx-auto w-[calc(100%-40px)] max-w-[1224px] md:w-[88%]">
          <VideoGallery content={content} locale={locale} />
        </div>
        <FaqSection items={content.faq.items} locale={locale} title={content.faq.title} />
        <TipsSection content={content} locale={locale} />
      </main>
      <FooterSection content={content} locale={locale} />
    </div>
  );
}
