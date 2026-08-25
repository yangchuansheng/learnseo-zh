"use client";

import { useState } from "react";
import content from "./content.json";

export function FaqSection() {
  const [open, setOpen] = useState<boolean[]>(() =>
    content.faq.items.map(() => false),
  );

  return (
    <section className="mx-auto my-[25px] w-[calc(100%_-_40px)] max-w-[1224px] md:my-[50px] md:w-[88%]">
      <h2 className="pb-5 text-[30.8px] leading-[30.8px] font-extrabold text-[#000036] md:pb-10 md:text-[47.6px] md:leading-[47.6px]">
        {content.faq.title}
      </h2>
      <div>
        {content.faq.items.map((item, index) => {
          const answerId = `faq-answer-${index + 1}`;
          const isOpen = open[index];

          return (
            <article
              className="mb-2.5 overflow-hidden rounded-lg bg-white md:rounded-[16px]"
              key={item.question}
            >
              <button
                className="relative flex min-h-[45.5px] w-full items-center px-3.5 py-3.5 pr-[35px] text-left text-[15.4px] leading-[17.5px] text-[#2e73ea] md:min-h-0 md:px-[3%] md:py-[2.3%] md:text-[18.7px] md:leading-[21.25px]"
                type="button"
                aria-expanded={isOpen}
                aria-controls={answerId}
                onClick={() =>
                  setOpen((current) =>
                    current.map((value, itemIndex) =>
                      itemIndex === index ? !value : value,
                    ),
                  )
                }
              >
                {item.question}
                <span
                  className={`absolute top-1/2 right-[4%] h-2 w-2.5 -translate-y-1/2 bg-[url('/sites/learningseo-io-071dae18/shared/arrow-accordion.svg')] bg-contain bg-center bg-no-repeat transition-transform duration-[400ms] md:right-[3%] md:h-2.5 md:w-3 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-[400ms] ease-in-out ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
                id={answerId}
                aria-hidden={!isOpen}
                inert={!isOpen}
              >
                <div className="overflow-hidden">
                  <div
                    className="px-[4%] pb-[2%] text-sm leading-[17.5px] [&_a]:text-[#2e73ea] [&_a_strong]:text-[#2e73ea] [&_h3]:mb-2 [&_h3]:text-[15.4px] [&_li]:relative [&_li]:my-2.5 [&_li]:pl-[15px] [&_li]:before:absolute [&_li]:before:top-[3px] [&_li]:before:left-0 [&_li]:before:h-[7px] [&_li]:before:w-[7px] [&_li]:before:-rotate-90 [&_li]:before:bg-[url('/sites/learningseo-io-071dae18/shared/arrow-accordion.svg')] [&_li]:before:bg-contain [&_li]:before:bg-center [&_li]:before:bg-no-repeat [&_li]:before:content-[''] [&_p]:mb-2 [&_strong]:font-extrabold [&_strong]:text-[#000036] md:px-[3%] md:text-[15.3px] md:leading-[21.25px] md:[&_h3]:mb-4 md:[&_h3]:text-[18.7px] md:[&_li]:pl-5 md:[&_li]:before:h-[9px] md:[&_li]:before:w-[9px] md:[&_p]:mb-4"
                    dangerouslySetInnerHTML={{ __html: item.answerHtml }}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
