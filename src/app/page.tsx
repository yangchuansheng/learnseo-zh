import { FaqSection } from "@/components/sites/learningseo-io-071dae18/root-8a5edab2/FaqSection";
import { FooterSection } from "@/components/sites/learningseo-io-071dae18/root-8a5edab2/FooterSection";
import { HeaderNavigation } from "@/components/sites/learningseo-io-071dae18/root-8a5edab2/HeaderNavigation";
import { HeroSection } from "@/components/sites/learningseo-io-071dae18/root-8a5edab2/HeroSection";
import { ResourceBanner } from "@/components/sites/learningseo-io-071dae18/root-8a5edab2/ResourceBanner";
import { RoadmapSection } from "@/components/sites/learningseo-io-071dae18/root-8a5edab2/RoadmapSection";
import { TipsSection } from "@/components/sites/learningseo-io-071dae18/root-8a5edab2/TipsSection";
import { VideoGallery } from "@/components/sites/learningseo-io-071dae18/root-8a5edab2/VideoGallery";

export default function Home() {
  return (
    <div data-learning-seo className="min-h-screen">
      <HeaderNavigation />
      <main className="relative">
        <HeroSection />
        <div className="mx-auto w-[calc(100%-40px)] max-w-[1224px] md:w-[88%]">
          <RoadmapSection />
        </div>
        <div className="mx-auto w-[calc(100%-40px)] max-w-[1224px] md:w-[88%]">
          <ResourceBanner />
        </div>
        <div className="mx-auto w-[calc(100%-40px)] max-w-[1224px] md:w-[88%]">
          <VideoGallery />
        </div>
        <FaqSection />
        <TipsSection />
      </main>
      <FooterSection />
    </div>
  );
}
