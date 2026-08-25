"use client";

import content from "./content.json";
import { VideoCard } from "./VideoCard";

export function VideoGallery() {
  return (
    <section
      className="relative left-1/2 my-10 grid w-screen -translate-x-1/2 grid-cols-1 gap-[10px] min-[1025px]:static min-[1025px]:my-20 min-[1025px]:w-full min-[1025px]:max-w-[1224px] min-[1025px]:translate-x-0 min-[1025px]:grid-cols-2"
      aria-label="Learning SEO Accelerator videos"
    >
      {content.videos.map((video, index) => (
        <VideoCard key={video.embed} {...video} index={index} />
      ))}
    </section>
  );
}
