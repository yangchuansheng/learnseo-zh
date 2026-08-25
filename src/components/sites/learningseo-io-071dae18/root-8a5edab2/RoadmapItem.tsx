"use client";

import { useId, useState } from "react";

import { ArrowRightIcon } from "../shared/Icons";

type RoadmapLink = {
  label: string;
  href: string;
};

type RoadmapItemProps = {
  number: string;
  title: string;
  href: string;
  descriptionHtml: string;
  links: RoadmapLink[];
  initiallyOpen: boolean;
};

export function RoadmapItem({
  number,
  title,
  href,
  descriptionHtml,
  links,
  initiallyOpen,
}: RoadmapItemProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const contentId = useId();

  return (
    <article className="relative rounded-lg bg-white py-[21px] pr-[34.5px] pl-7 md:px-[42px] md:py-[25.5px]">
      <span
        aria-hidden="true"
        className="absolute left-[-13px] top-[15px] z-20 flex size-[30px] items-center justify-center rounded-full bg-[#a87be9] text-[14px] leading-none font-extrabold text-white md:left-[-15px] md:top-[18px] md:size-[35px] md:text-[17px]"
      >
        {number}
      </span>

      <h3
        className={`pr-8 text-[15.4px] leading-[16.1px] font-bold text-[#000036] uppercase md:pr-10 md:text-[18.7px] md:leading-[21.25px] ${isOpen ? "md:mb-2.5 xl:mb-0" : ""}`}
      >
        <a href={href}>{title}</a>
      </h3>

      <button
        type="button"
        aria-controls={contentId}
        aria-expanded={isOpen}
        aria-label={`${isOpen ? "Collapse" : "Expand"} ${title}`}
        className="absolute top-[8px] right-[8px] flex size-10 cursor-pointer items-center justify-center text-[#9c63ef]"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="absolute h-px w-[14px] bg-current" />
        <span
          className={`absolute h-[14px] w-px bg-current transition-transform duration-[400ms] ${isOpen ? "scale-y-0" : "scale-y-100"}`}
        />
      </button>

      <div
        id={contentId}
        aria-hidden={!isOpen}
        className={`grid transition-[grid-template-rows,opacity] duration-[400ms] ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            className="py-[10px] text-[14px] leading-[17.5px] text-[#606060] md:text-[17px] md:leading-[21.25px] [&_a]:text-[#2e73ea] [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />

          <div className="grid grid-cols-2 gap-x-[10px] md:grid-cols-3">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                tabIndex={isOpen ? undefined : -1}
                className="group mt-[5px] flex min-w-0 items-center justify-between gap-2 rounded border border-[#a87be9] px-3 py-2 text-[12.6px] leading-[14.7px] text-[#303030] duration-100 hover:bg-[#a87be9] hover:text-white md:mt-[15px] md:self-start md:justify-self-start md:gap-[13.4px] md:text-[15.3px] md:leading-[21.25px]"
              >
                <span>{link.label}</span>
                <ArrowRightIcon className="shrink-0 text-[#a87be9] group-hover:text-white" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
