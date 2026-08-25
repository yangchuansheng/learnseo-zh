"use client";

import Image from "next/image";
import { useState } from "react";

import { PlayIcon } from "../shared/Icons";

type VideoCardProps = {
  description: string;
  embed: string;
  iframeTitle: string;
  index: number;
  title: string;
};

export function VideoCard({
  description,
  embed,
  iframeTitle,
  index,
  title,
}: VideoCardProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const thumbnail = `/sites/learningseo-io-071dae18/root-8a5edab2/video-${String(index + 1).padStart(2, "0")}.jpg`;

  return (
    <article>
      <div className="relative aspect-video overflow-hidden bg-[#000036]">
        {isPlaying ? (
          <iframe
            className="absolute inset-0 size-full border-0"
            src={`${embed}${embed.includes("?") ? "&" : "?"}autoplay=1`}
            title={iframeTitle}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        ) : (
          <>
            <Image
              className="object-cover"
              src={thumbnail}
              alt=""
              fill
              sizes="(min-width: 1025px) 607px, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 to-black/60" />
            <div className="absolute right-[27px] bottom-[19px] left-[27px] z-10 min-[1025px]:top-[148px] min-[1025px]:right-[42.5px] min-[1025px]:bottom-auto min-[1025px]:left-[42.5px]">
              <h3 className="text-[21px]/[24.5px] font-extrabold text-white min-[1025px]:text-[25.5px]/[29.75px]">
                {title}
              </h3>
              <p className="mt-1 hidden text-[17px]/[21.25px] text-white min-[1025px]:block">
                {description}
              </p>
            </div>
            <button
              className="absolute top-1/2 left-1/2 z-20 flex size-[60px] -translate-x-1/2 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-white text-[#000036] min-[1025px]:top-[24px] min-[1025px]:right-[30px] min-[1025px]:left-auto min-[1025px]:size-[80px] min-[1025px]:translate-x-0 min-[1025px]:translate-y-0"
              type="button"
              aria-label={`Play ${title}`}
              onClick={() => setIsPlaying(true)}
            >
              <PlayIcon className="ml-1 h-[23px] w-5 min-[1025px]:h-[34px] min-[1025px]:w-[30px]" />
            </button>
          </>
        )}
      </div>
      <p className="bg-[#000036] px-[27.3px] py-[19.5px] text-[14px]/[17.5px] text-white min-[1025px]:hidden">
        {description}
      </p>
    </article>
  );
}
