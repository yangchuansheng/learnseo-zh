import { VideoCard } from "./VideoCard";
import type { Locale } from "@/lib/localization";
import { getSiteContent, type SiteContent } from "./content";

export function VideoGallery({ content, locale = "zh-CN" }: { content?: SiteContent; locale?: Locale }) {
  const siteContent = content ?? getSiteContent(locale);
  return (
    <section
      className="relative left-1/2 my-10 grid w-screen -translate-x-1/2 grid-cols-1 gap-[10px] md:left-[-20px] md:w-[calc(100%+40px)] md:translate-x-0 xl:static xl:my-20 xl:w-full xl:max-w-[1224px] xl:grid-cols-2"
      aria-label={locale === "en" ? "Learning SEO Accelerator videos" : "Learning SEO Accelerator 视频"}
    >
      {siteContent.videos.map((video, index) => (
        <VideoCard key={video.embed} {...video} index={index} locale={locale} />
      ))}
    </section>
  );
}
