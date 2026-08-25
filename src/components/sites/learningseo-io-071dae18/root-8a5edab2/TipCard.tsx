"use client";

import Image from "next/image";
import { useState } from "react";
import content from "./content.json";

type Tip = (typeof content.tips.items)[number];

export function TipCard({ tip }: { tip: Tip }) {
  const [open, setOpen] = useState(false);
  const linkedIn = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
    `${content.source}#${tip.id}`,
  )}`;

  return (
    <article
      className="relative mb-5 inline-block w-[98%] break-inside-avoid rounded-2xl bg-white px-6 pt-6 pb-[50px] align-top text-[12.6px] leading-[17.5px] min-[600px]:w-[calc(100%_-_20px)] md:text-[15.3px] md:leading-[21.25px]"
      id={tip.id}
    >
      <p>{tip.text}</p>
      <p className="mt-2.5 font-extrabold text-[#000036]">{tip.author}</p>
      <div className="absolute right-5 bottom-5 z-10">
        <button
          className="flex h-8 items-center gap-1.5 rounded-full bg-[#000036] py-1.5 pr-2.5 pl-1.5 font-bold text-white"
          type="button"
          aria-expanded={open}
          aria-controls={`${tip.id}-share`}
          onClick={() => setOpen((value) => !value)}
        >
          <Image
            className="h-5 w-5"
            src="/sites/learningseo-io-071dae18/shared/share-circle.svg"
            alt=""
            width="20"
            height="20"
          />
          Share
        </button>
        {open ? (
          <div
            className="absolute top-[45px] right-0 flex min-h-[92px] w-[120px] flex-col items-start justify-center gap-[5px] rounded-[10px] bg-white py-2.5 pr-[25px] pl-2.5 leading-5 text-[#000036] shadow-[0_0_5px_rgba(0,0,0,.15)]"
            id={`${tip.id}-share`}
          >
            {[
              ["X", tip.share.x, "twitter-circle-black.svg"],
              ["LinkedIn", linkedIn, "linkedin-circle-black.svg"],
              ["Threads", tip.share.threads, "threads-circle-black.svg"],
            ].map(([label, href, icon]) => (
              <a
                className="flex items-center gap-2.5 whitespace-nowrap"
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Share on ${label}`}
                key={label}
              >
                <Image
                  className="h-5 w-5"
                  src={`/sites/learningseo-io-071dae18/shared/${icon}`}
                  alt=""
                  width="20"
                  height="20"
                />
                {label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
