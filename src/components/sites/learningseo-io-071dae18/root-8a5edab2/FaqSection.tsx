"use client";

import { useState } from "react";
import content from "./content.json";

export function FaqSection() {
  const [open, setOpen] = useState<boolean[]>(() =>
    content.faq.items.map(() => false),
  );

  return (
    <section className="mx-auto my-[50px] w-[calc(100%-40px)] max-w-[1224px]">
      <h2 className="pb-5 text-[30.8px] leading-[30.8px] font-extrabold text-[#000036] md:pb-10 md:text-[47.6px] md:leading-[47.6px]">
        {content.faq.title}
      </h2>
      <div>
        {content.faq.items.map((item, index) => {
          const answerId = `faq-answer-${index + 1}`;
          const isOpen = open[index];

          return (
            <article
              className="mb-2.5 overflow-hidden rounded-lg bg-white md:rounded-2xl"
              key={item.question}
            >
              <button
                className="relative flex min-h-[45.5px] w-full items-center px-3.5 py-3.5 pr-[35px] text-left text-[15.4px] leading-[17.5px] text-[#2e73ea] md:min-h-[77.5px] md:px-[36.7px] md:py-[28px] md:text-[18.7px] md:leading-[21.25px]"
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
                  className="absolute right-3.5 text-xl leading-none font-light md:right-9"
                  aria-hidden="true"
                >
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              <div
                className={`grid transition-[grid-template-rows,opacity] duration-400 ease-in-out ${
                  isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                }`}
                id={answerId}
              >
                <div className="overflow-hidden">
                  <div
                    className="px-[4%] pb-[2%] text-sm leading-[17.5px] [&_a]:text-[#2e73ea] [&_a]:underline [&_p]:mb-2 md:px-[3%] md:text-[15.3px] md:leading-[21.25px] md:[&_p]:mb-4"
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
