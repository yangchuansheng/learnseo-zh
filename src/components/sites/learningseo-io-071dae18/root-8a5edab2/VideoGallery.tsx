import content from "./content.json";
import { VideoCard } from "./VideoCard";

export function VideoGallery() {
  return (
    <section
      className="relative left-1/2 my-10 grid w-screen -translate-x-1/2 grid-cols-1 gap-[10px] md:left-[-20px] md:w-[calc(100%+40px)] md:translate-x-0 xl:static xl:my-20 xl:w-full xl:max-w-[1224px] xl:grid-cols-2"
      aria-label="Learning SEO Accelerator videos"
    >
      {content.videos.map((video, index) => (
        <VideoCard key={video.embed} {...video} index={index} />
      ))}
    </section>
  );
}
