import content from "./content.json";
import { TipCard } from "./TipCard";

export function TipsSection() {
  return (
    <section className="mt-[60px] overflow-hidden bg-[url('/sites/learningseo-io-071dae18/shared/tips.png')] bg-[length:60%_auto] bg-right-top bg-no-repeat py-[60px] md:mt-[100px] md:bg-auto md:py-[100px]">
      <div className="mx-auto w-[88%] max-w-[1224px] md:w-[85%]">
        <h2 className="max-w-[740px] pb-5 text-[35px] leading-[35px] font-extrabold text-[#000036] md:pb-[50px] md:text-[59.5px] md:leading-[59.5px]">
          {content.tips.title}
        </h2>
        <div
          className="max-w-[740px] text-sm leading-[23.8px] [&_a]:text-[#2e73ea] [&_a]:underline md:text-[17px] md:leading-[28.9px]"
          dangerouslySetInnerHTML={{ __html: content.tips.introHtml }}
        />
      </div>

      <div className="mx-auto mt-[30px] w-[90%] max-w-[1224px] columns-1 gap-0 md:mt-[50px] md:columns-2 xl:columns-3">
        {content.tips.items.map((tip) => (
          <TipCard key={tip.id} tip={tip} />
        ))}
      </div>
    </section>
  );
}
